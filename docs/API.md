# API — Contrato v1

## 1. Convenções

- Base: `/api/v1`. JSON; erros no formato `{ error: { code, message, details? } }`.
- Autenticação: cookie de sessão (Auth.js). Todos os endpoints exigem sessão, exceto
  os de auth (`/api/v1/auth/*`).
- Todo endpoint filtrado por contexto (tenantId/storeId da sessão), com validação Zod.
- Códigos: 200 OK · 201 Created · 400 validação · 401 não autenticado · 403 sem
  permissão · 404 não encontrado (tenant-scoped, para não vazar existência) ·
  409 conflito · 429 rate limit · 500 erro.
- Listagem: `GET {recurso}?limit=&cursor=` (cursor-based, ordenado por `createdAt`/`id`).

## 2. Auth

| Método | Rota | Descrição | Perm |
|---|---|---|---|
| POST | `/api/v1/auth/login` | login por email/senha → sessão | pública (rate limited) |
| POST | `/api/v1/auth/logout` | encerra sessão | autenticado |
| GET | `/api/v1/session` | sessão atual (tenant, unidade, permissões) | autenticado |
| POST | `/api/v1/session/store` | troca de unidade (valida acesso) | autenticado |

## 3. Recursos

| Método | Rota | Descrição | Perm |
|---|---|---|---|
| GET/POST | `/api/v1/products` | listar(unit store)/criar produto | `products.create` (POST) |
| GET/PUT | `/api/v1/products/:id` | consultar/atualizar | `products.update` |
| GET | `/api/v1/products/barcode/:code` | resolver código de barras | autenticado |
| GET/POST | `/api/v1/products/categories` | categorias | `products.create` |
| GET/POST | `/api/v1/unit-measures` | UoM (inclusive conversões) | `products.create` |
| GET/POST | `/api/v1/customers` | clientes | `customers.manage` |
| GET/POST | `/api/v1/customer-categories` | categorias de cliente | `customers.manage` |
| GET | `/api/v1/pricing/price?productId=&quantity=` | resolver preço (PricingService) | autenticado |
| GET/POST | `/api/v1/price-tables` | tabelas de preço | `pricing.manage` |
| GET/POST | `/api/v1/promotions` | promoções | `pricing.manage` |
| GET | `/api/v1/inventory/balance?productId=` | saldo da unidade | autenticado |
| POST | `/api/v1/inventory/adjust` | ajuste (com motivo) | `inventory.adjust` |
| GET/POST | `/api/v1/cash-registers` | caixas | `cash.close`/admin |
| POST | `/api/v1/cash-sessions/open` | abre caixa | `cash.open` |
| POST | `/api/v1/cash-sessions/:id/withdraw` | sangria | `cash.withdraw` |
| POST | `/api/v1/cash-sessions/:id/supply` | suprimento | `cash.supply` |
| POST | `/api/v1/cash-sessions/:id/close` | fecha caixa (com saldo contado) | `cash.close` |
| POST | `/api/v1/sales` | cria venda (online/offline, idempotente por clientOperationId) | `sales.create` |
| POST | `/api/v1/sales/:id/cancel` | cancelamento | `sales.cancel` |
| POST | `/api/v1/sales/:id/refund` | estorno | `sales.refund` |
| POST | `/api/v1/sync` | push de operações | autenticado (rate limited) |
| GET | `/api/v1/sync?since=&entity=` | pull incremental | autenticado |
| GET | `/api/v1/audit-logs` | auditoria (filtros tenant/store/período/ação) | `reports.view` |
| POST | `/api/v1/fiscal/operations` | enfileira operação fiscal | `fiscal.issue` |
| GET | `/api/v1/fiscal/operations/:id` | estado da operação | `fiscal.issue` |

> Rotas fiscais/acesso podem sofrer ajuste fino nas fases respectivas; o erro nunca
> expõe existência cross-tenant (404).

## 4. Exemplo de payloads

**POST /api/v1/sales** (venda offline/online):

```json
{
  "clientOperationId": "uuid-v4",
  "registerId": "cuid",
  "terminalId": "cuid",
  "customerId": null,
  "items": [{ "productId": "cuid", "quantity": 2, "unitOfMeasure": "UN" }],
  "payments": [{ "methodCode": "CASH", "amount": "50.00" }],
  "discount": "0.00",
  "discountReason": null
}
```

Resposta: `201 { sale: {...}, items: [...], change: "10.00" }` (troco apenas CASH).

**POST /api/v1/cash-sessions/:id/close**:

```json
{ "countedByMethod": { "CASH": "1450.00" } }
```

Resposta: `{ expected, counted, difference, classification: EXACT|SURPLUS|SHORTAGE }`.

## 5. Decimais

Todos os valores monetários trafegam como **string** (`"10.50"`) para evitar perda de
precisão; clientes usam helper de conversão. Internamente Prisma `Decimal`.