# STOCK — Estoque por Unidade

> ADRs: `docs/adr/ADR-0005` (concorrência/portabilidade) e `docs/adr/ADR-0006`
> (reserva futura). Estoque é **por unidade** (store), nunca global do tenant.

## 1. Entidades

**StockBalance** — saldo único por `(tenantId, storeId, productId)`:

```
id, tenantId, storeId, productId,
quantity          (Decimal)  // estoque físico
reservedQuantity  (Decimal)  // reserva futura (F11); NÃO tratar como movimentação
availableQuantity (Decimal)  // available = quantity - reservedQuantity
version           (Int)      // optimistic concurrency
createdAt, updatedAt
```

> **Reserva ≠ movimento.** Reserva é comprometimento temporário de estoque
> (ex.: venda em andamento), não altera `quantity` nem gera `StockMovement`.
> Por decisão aprovada em ADR-0006, a reserva **não é implementada na F8** — apenas
> os campos existem para o fluxo do PDV (F11). Regra prática: `StockMovement` só
> registra variação de `quantity` (movimentação física).

**StockMovement** — histórico de movimentação, sempre na **unidade base** do produto:

```
id, tenantId, storeId, productId,
type            (IN | OUT | ADJUST | TRANSFER_IN | TRANSFER_OUT)
quantity        (Decimal)  // variação na unidade base (o que o saldo de fato mudou)
quantityInUnit  (Decimal?) // quantidade como informada na unidade do movimento
unitOfMeasureId (String?)  // unidade de medida em que o movimento foi registrado
balanceAfter    (Decimal)  // saldo (quantity) após o movimento
reason?, referenceType? (SALE|PURCHASE|INVENTORY|TRANSFER), referenceId?,
createdBy?, createdAt
```

**StockTransfer / StockTransferItem** — transferência **multiproduto** entre unidades:

```
StockTransfer: id, tenantId, storeId (origem), destinationStoreId (destino),
               status (COMPLETED | futuro: SOLICITADA→SEPARADA→EXPEDIDA→RECEBIDA),
               reason?, createdBy?, createdAt, completedAt?
StockTransferItem: id, transferId, productId, quantity (unidade base),
                   quantityInUnit?, unitOfMeasureId?, createdAt
```

**Inventory / InventoryItem** — inventário (contagem) por unidade:

```
Inventory: id, tenantId, storeId, status (OPEN | CLOSED), notes?,
           startedAt, finishedAt?, createdBy?
InventoryItem: id, inventoryId, productId,
               expectedQuantity (snapshot do saldo na abertura),
               countedQuantity? (contagem informada),
               difference?      (= countedQuantity - expectedQuantity)
```

**ProductStore** — `minStock`/`maxStock` (estoque mínimo/máximo por unidade):

```
status (ACTIVE default), minStock (0 = sem mínimo), maxStock (0 = sem máximo)
```

## 2. StockService

Entrada/saída tipadas:

```ts
StockEntryInput  { productId, quantity, unitOfMeasureId?, reason? }   // stockIn / stockOut
StockAdjustInput { productId, delta, reason? }                        // adjust (Δ assinado ≠ 0)
StockTransferInput { destinationStoreId, reason?, items: [{ productId, quantity, unitOfMeasureId? }] }
UpdateMinMaxInput { productId, minStock, maxStock }
```

Assinatura: `StockService.stockIn/stockOut/adjust/transfer/setMinMax` executam todo o
fluxo (validação + movimentação + auditoria) numa única transação. Consultas:
`balance`, `listAll`, `alerts`, `history`, `listTransfers`.

## 3. Unidade de medida e conversão

- O estoque é mantido na **unidade base** (`Product.baseUnitId`), consistente.
- Ao registrar um movimento, a quantidade informada é convertida para a unidade base
  **exclusivamente** pelo mecanismo central de conversão (`UnitConversion` via
  `services/unit-converter.ts`) — nunca por regra hardcoded.
- O movimento grava `quantity` (base), `quantityInUnit` (informada) e
  `unitOfMeasureId` (unidade usada), preservando o que foi registrado.

Exemplo: produto com `baseUnitId = UN`; conversão `1 CX = 12 UN`. Entrada de
`2 CX` → movimento `quantity = 24`, `quantityInUnit = 2`, `unitOfMeasureId = CX`.

Sem conversão configurada → `400 UNIT_CONVERSION_MISSING` (o movimento é recusado).

## 4. Concorrência (ADR-0005)

`StockBalanceRepository.applyDelta` (dentro da transação da operação):

1. **Atômico em SQL** — `UPDATE ... SET quantity = quantity + delta,
   availableQuantity = availableQuantity + delta, version = version + 1
   WHERE id = ? AND tenantId = ? AND storeId = ? AND quantity + delta >= 0`.
2. **Ajuste positivo** — `upsert` por `@@unique(tenantId, storeId, productId)` (cria
   com `version = 1` na primeira entrada).
3. **Guarda não-negativa** na própria instrução: saldo nunca fica negativo em
   condição de corrida. Linhas alteradas = 0 → conflito.
4. **Optimistic concurrency** — `expectedVersion` opcional: se a versão atual
   divergir → `VERSION_CONFLICT` (retry/ajuste manual); caso contrário sem
   `expectedVersion`, conflito de quantidade → `INSUFFICIENT`.
5. Sem `SELECT ... FOR UPDATE`, sem locks/bibliotecas específicas de PostgreSQL —
   portável para SQL Server.
6. Venda (F11): baixa de estoque é a última etapa crítica da transação; conflito →
   rollback total; nunca estoque negativo silencioso.

`adjust` com delta negativo usa o mesmo guard → nunca negativo. Transferência só
movimenta depois de **validar o saldo de todos os itens** (rollback se qualquer item
falhar).

## 5. Transferência (atômica)

`StockService.transfer` executa num bloco único:

```
BEGIN
→ valida origem (ACTIVE) ≠ destino (400 SAME_STORE_TRANSFER)
→ valida produtos (ACTIVE) e converte unidades de cada item
→ aplica baixa (guard não-negativo) em TODOS os itens da origem ← validação de saldo total
→ registra StockTransfer (status COMPLETED) + StockTransferItems
→ para cada item: movimento TRANSFER_OUT (origem) + alta no destino + TRANSFER_IN
→ auditoria STOCK_TRANSFER
COMMIT
```

Qualquer item com saldo insuficiente → `409 STOCK_INSUFFICIENT` e **rollback total**
(nenhum item é movimentado). O `status` do registro permite evolução futura para o
workflow SOLICITADA → SEPARADA → EXPEDIDA → RECEBIDA sem alterar o modelo.

## 6. Inventário

`InventoryService.open` tira o snapshot (`expectedQuantity`) de todos os produtos
ATIVOS na unidade — só existe **um inventário OPEN por unidade**
(`409 INVENTORY_OPEN_EXISTS`). `close` exige contagem de **todos** os itens
(`400 INVENTORY_ITEMS_INCOMPLETE`); para cada item:

```
difference = countedQuantity - expectedQuantity
```

- `difference = 0` → sem movimento.
- `difference ≠ 0` → `StockBalanceRepository.applyDelta(difference)` + movimento
  `ADJUST` com `referenceType = INVENTORY` e `referenceId = inventory.id`.
- Caminho de auditoria reconstruível: saldo esperado → contagem → diferença →
  ajuste aplicado (movimento ADJUST referenciando o inventário).

Re-fechar inventário fechado → `409 INVENTORY_ALREADY_CLOSED`. Auditoria:
`INVENTORY_CREATED` / `INVENTORY_CLOSED`.

## 7. Alertas (estoque mínimo/máximo)

Definidos por `ProductStore.minStock`/`maxStock` (0 = desabilitado). Nível por
`availableQuantity`:

```
min > 0 && available <= min  → LOW
max > 0 && available >= max  → HIGH
senão                        → OK
```

`StockService.alerts` retorna apenas itens `LOW`/`HIGH` (computed — sem tabela nova).

## 8. API

`/api/v1/inventory/**` — ler saldos é autenticado; movimentar exige permissão:

| Rota | Permissão |
|---|---|
| GET `/inventory` (saldos), `/inventory/balance`, `/inventory/movements`, `/inventory/alerts` | autenticado |
| POST `/inventory/stock-in`, `/inventory/stock-out`, `/inventory/adjust` | `inventory.adjust` |
| PUT `/inventory/min-max` | `inventory.adjust` |
| POST `/inventory/transfers`, GET `/inventory/transfers` | `inventory.transfer` |
| POST `/inventory/counts`, GET `/inventory/counts`, GET `/inventory/counts/:id`, POST `/inventory/counts/:id/close` | `inventory.adjust` |

`storeId` default = unidade da sessão (gerentes podem informar outra unidade).

## 9. Auditoria

`STOCK_IN`, `STOCK_OUT`, `STOCK_ADJUSTED`, `STOCK_MIN_MAX_UPDATED`,
`STOCK_TRANSFER`, `INVENTORY_CREATED`, `INVENTORY_CLOSED` (entidade
`StockBalance`/`StockTransfer`/`ProductStore`/`Inventory`).

## 10. Testes obrigatórios (F8-11)

1. Entrada/saída/ajuste alteram saldo com `version` incrementada.
2. Saída maior que saldo → `STOCK_INSUFFICIENT` (nunca negativo).
3. Conversão de unidade (2 CX → 24 UN) registra `quantity`/`quantityInUnit`/`unitOfMeasureId`.
4. Unidade sem conversão → `UNIT_CONVERSION_MISSING`.
5. Transferência multiproduto baixa origem e credita destino.
6. Rollback total quando um item não tem saldo.
7. Origem = destino → `SAME_STORE_TRANSFER`.
8. Inventário com diferença negativa, positiva e nula (ajuste via ADJUST ref INVENTORY).
9. Concorrência: N movimentos em paralelo sem perda de atualização; saldo nunca negativo.
10. Optimistic `expectedVersion` obsoleto → `VERSION_CONFLICT`.
11. Isolamento tenant A × B e store A1 × A2 (saldo/histórico independentes).