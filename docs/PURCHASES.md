# PURCHASES — Compras e Fornecedores

Compras cobrem o ciclo: cadastro de **fornecedores** (F9-01) → **pedido de compra**
(F9-02) → **entrada** com atualização de **custo** (F9-04), **lote** (F9-05) e
**validade** (F9-06) → **integração com estoque** (F9-07, F8). Deps: F2 (multi-tenant)
e F5 (produtos/unidades).

## 1. Entidades

**Supplier** — fornecedor do tenant (`TenantScoped`, sem `storeId`):

```
id, tenantId,
name, document? (CNPJ/CPF, único por tenant), email?, phone?,
address?, city?, state? (UF), zipCode?, notes?,
status (ACTIVE | INACTIVE), createdAt, updatedAt
```

**Purchase** — pedido de compra da unidade (`StoreScoped`):

```
id, tenantId, storeId, supplierId?,
status (ORDERED | RECEIVED | CANCELLED)  // fluxo: ORDERED → RECEIVED | CANCELLED
totalAmount (Decimal, = soma dos totalCost dos itens),
notes?, expectedAt?, receivedAt?, createdBy?, createdAt, updatedAt
```

**PurchaseItem** — item-filho do pedido (apenas `tenantId`, via `Purchase`):

```
id, tenantId, purchaseId, productId,
quantity (Decimal, na unidade informada do item),
quantityInUnit?, unitOfMeasureId?,   // gravados na entrada (conversão → unidade base)
unitCost (Decimal) = custo unitário,
totalCost (Decimal) = quantity × unitCost,
batchNumber? (lote), expiryDate? (validade), createdAt
```

> **Lote/validade (`PurchaseItem`):** registrados no pedido (e sobrepostos na entrada).
> Não há saldo de estoque **por lote** no MVP — `StockBalance` permanece
> tenant+store+product (única). Rastreabilidade futura pode adicionar rastreamento por
> lote sem mudar este modelo.

## 2. Fluxo de status

```
        ┌─────────┐   edita/cancela/recebe   ┌──────────┐
        │ ORDERED │ ───────────────────────► │ RECEIVED │
        └────┬────┘                          └──────────┘
             │ cancela
             ▼
        ┌──────────┐
        │ CANCELLED │
        └──────────┘
```

- **ORDERED** — criado; pode ser editado, cancelado ou recebido.
- **RECEIVED** — entrada aplicada (estoque + itens finalizados); **não** edita/cancela.
- **CANCELLED** — sem efeito de estoque; final.

`409 PURCHASE_NOT_EDITABLE` / `PURCHASE_NOT_CANCELLABLE` /
`PURCHASE_NOT_RECEIVABLE` protegem o ciclo. **Não há recebimento parcial** no MVP —
a entrada aplica todos os itens do pedido de uma vez.

## 3. Entrada e integração estoque (F9-03, F9-07)

`PurchaseService.receive` dentro de uma única transação:

```
BEGIN
→ pedido deve estar ORDERED (senão 409)
→ para cada item (ordem da própria compra):
   → convert = toBaseQuantity(tenantId, produto.baseUnitId, item.unitOfMeasureId, item.quantity)
     (sem conversão configurada → 400 UNIT_CONVERSION_MISSING; rollback)
   → result = StockBalanceRepository.applyDelta(tx, { storeId, productId, delta: +converted.quantity })
     (falha de aplicação → 409 STOCK_APPLY_FAILED; rollback)
   → atualiza item: quantityInUnit / unitOfMeasureId / batchNumber / expiryDate (overrides)
   → tx.stockMovement.create:
     { type: 'IN', quantity: converted.quantity, quantityInUnit, unitOfMeasureId,
       balanceAfter: result.balanceAfter, reason: 'Entrada por pedido de compra',
       referenceType: 'PURCHASE', referenceId: pedido.id, createdBy }
→ pedido → status RECEIVED + receivedAt = now
→ auditoria PURCHASE_RECEIVED
COMMIT
```

Mesmo padrão atômico de estoque do F8 (ADR-0005): a conversão central
(`UnitConversion`) garante que `quantity` no `StockMovement` fique sempre na **unidade
base**; `quantityInUnit`/`unitOfMeasureId` preservam o que foi recebido.

## 4. Custo (F9-04)

- `PurchaseItem.unitCost` = custo unitário informado (pode diferir da unidade de
  medida: ex. custo por CX); `totalCost = quantity × unitCost`.
- `Purchase.totalAmount` = Σ `totalCost` dos itens (custo da mercadoria, sem impostos).
- Recomputado no reenvio de itens (`update`).

## 5. Regras de validação

- `create`: `storeId` default = unidade da sessão (`400 STORE_REQUIRED` se ausente);
  unidade deve ser ACTIVE do tenant (`400 INVALID_STORE`); fornecedor (se informado)
  ACTIVE do tenant (`400 INVALID_SUPPLIER`); produtos ACTIVE do tenant
  (`404 PRODUCT_NOT_FOUND`); itens com `productId` duplicado → 400 (validação Zod).
- `update`: apenas ORDERED; itens substituídos em bloco (deleteMany + create) e
  `totalAmount` recalculado.
- `receive`: overrides opcionais `items: [{ productId, batchNumber?, expiryDate? }]`.

## 6. API

| Rota | Permissão |
|---|---|
| GET `/api/v1/suppliers?search=&includeInactive=` | autenticado |
| POST `/api/v1/suppliers` | `purchases.manage` |
| GET/PUT/DELETE `/api/v1/suppliers/:id` | `purchases.manage` (DELETE = soft, INACTIVE) |
| GET `/api/v1/purchases?storeId=&status=` | autenticado |
| POST `/api/v1/purchases` | `purchases.manage` |
| GET/PUT/DELETE `/api/v1/purchases/:id` | `purchases.manage` (DELETE = cancelamento) |
| POST `/api/v1/purchases/:id/receive` | `purchases.manage` |

Conflitos: `409 SUPPLIER_DOCUMENT_TAKEN`, `SUPPLIER_EMAIL_TAKEN`,
`PURCHASE_NOT_EDITABLE`, `PURCHASE_NOT_CANCELLABLE`, `PURCHASE_NOT_RECEIVABLE`,
`STOCK_APPLY_FAILED`. Não-encontrado: `404 SUPPLIER_NOT_FOUND`,
`404 PURCHASE_NOT_FOUND` (nunca vaza existência cross-tenant).

## 7. Auditoria

`SUPPLIER_CREATED`, `SUPPLIER_UPDATED`, `SUPPLIER_DEACTIVATED`,
`PURCHASE_CREATED`, `PURCHASE_UPDATED`, `PURCHASE_CANCELLED`, `PURCHASE_RECEIVED`
(entidades `Supplier`/`Purchase`).

## 8. Testes obrigatórios

1. Fornecedor: criar/atualizar/desativar + `SUPPLIER_*_TAKEN` + `404` + auditoria.
2. Pedido com múltiplos itens: `totalAmount` = Σ `totalCost`.
3. Pedido sem `storeId` → `400 STORE_REQUIRED`; unidade de outro tenant → `404`.
4. Produto/fornecedor inexistente → `404`/`400`.
5. Edição de ORDERED (substituição de itens) recalcula total; RECEIVED/CANCELLED → 409.
6. Entrada aplica saldo (balanceAfter), grava StockMovement IN ref PURCHASE, item
   finalizado (`unitOfMeasureId`/`quantityInUnit`/`batchNumber`/`expiryDate`), pedido
   RECEIVED + `receivedAt`.
7. Conversão de unidade na entrada (2 CX → 24 UN).
8. Unidade sem conversão → `400 UNIT_CONVERSION_MISSING` com rollback (pedido permanece ORDERED).
9. Isolamento tenant A × B (fornecedores/pedidos independentes; documento pode repetir).