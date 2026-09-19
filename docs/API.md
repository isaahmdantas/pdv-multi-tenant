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

### 2.1 Login (`POST /api/v1/auth/login`)

Rate limit: 5/min por IP (janela deslizante in-memory, 429 + `Retry-After`).

```json
{ "email": "admin@loja.local", "password": "admin12345", "tenantSlug": "loja-demo" }
```

`tenantSlug` é opcional; obrigatório apenas quando o e-mail existe em mais de um
tenant (senão `400 MULTIPLE_TENANTS`). Resposta `200` define o cookie de sessão
(httpOnly) e devolve:

```json
{
  "user": { "id": "...", "name": "...", "email": "...", "tenantId": "...",
            "storeId": "...", "role": "ADMIN", "permissions": ["sales.create", "..."] }
}
```

- `401 INVALID_CREDENTIALS` — e-mail/senha incorretos (mensagem única, sem vazar existência).
- `403 INACTIVE_USER` — usuário inativo.
- Erros de auditoria: `LOGIN`.

### 2.2 Sessão (`GET /api/v1/session`)

Devolve `{ session: { tenantId, userId, storeId, role, permissions } }`, lido
exclusivamente do JWT (cookie httpOnly). Nunca reflete tenant/store enviados pelo cliente.

### 2.3 Troca de unidade (`POST /api/v1/session/store`)

```json
{ "storeId": "..." }
```

Valida em banco: unidade pertence ao tenant (404 `STORE_NOT_FOUND`, não vaza
existência), acesso por `UserStore` **ou** role com `globalStoreAccess` (403
`STORE_NOT_ALLOWED`), recalcula role/permissões efetivas (role da unidade vence a
global), reemite o JWT com o mesmo secret/salt, e audita `STORE_SWITCHED`
(before/after `{storeId}`). Resposta: `{ storeId, role, permissions }`.

### 2.4 RBAC (usuários/roles/permissões)

| Método | Rota | Descrição | Perm |
|---|---|---|---|
| GET | `/api/v1/users` | lista usuários do tenant (roles + unidades) | `settings.manage` |
| POST | `/api/v1/users` | cria usuário (argon2, roles + UserStore) | `settings.manage` |
| GET | `/api/v1/roles` | lista roles do tenant com permissões | `settings.manage` |
| POST | `/api/v1/roles` | cria role (valida `permissionCodes` ∈ catálogo) | `settings.manage` |
| GET | `/api/v1/permissions` | catálogo de permissões (`[{ code }]`) | `settings.manage` |

POST `/api/v1/roles` — conflito 409 `ROLE_TAKEN`; códigos inválidos 400
`INVALID_PERMISSIONS`. Auditoria: `ROLE_CREATED`, `USER_CREATED`.

### 2.5 Unidades (stores), usuários×unidade, caixas e terminais

| Método | Rota | Descrição | Perm |
|---|---|---|---|
| GET | `/api/v1/stores` | lista unidades ativas do tenant | `settings.manage` |
| POST | `/api/v1/stores` | cria unidade (valida `code` único) | `settings.manage` |
| GET | `/api/v1/stores/:id` | detalhe da unidade | `settings.manage` |
| PUT | `/api/v1/stores/:id` | atualização parcial (document, contato, endereço, timezone, fiscal*) | `settings.manage` |
| DELETE | `/api/v1/stores/:id` | desativa (soft → status `INACTIVE`) | `settings.manage` |
| GET | `/api/v1/users/:id` | usuário com unidades concedidas | `settings.manage` |
| POST | `/api/v1/users/:id/stores` | concede unidade ao usuário (`{ storeId, storeRoleId? }`) | `settings.manage` |
| PUT | `/api/v1/users/:id/stores/:storeId` | altera `storeRoleId` (override de role na unidade) | `settings.manage` |
| DELETE | `/api/v1/users/:id/stores/:storeId` | revoga acesso do usuário à unidade | `settings.manage` |
| GET | `/api/v1/cash-registers?storeId=` | lista caixas (registro; operação é F10) | `settings.manage` |
| POST | `/api/v1/cash-registers` | cria caixa `{ storeId, name }` | `settings.manage` |
| DELETE | `/api/v1/cash-registers/:id` | desativa caixa | `settings.manage` |
| GET | `/api/v1/terminals?storeId=` | lista terminais (mode POS/SELF_CHECKOUT/ADMIN) | `settings.manage` |
| POST | `/api/v1/terminals` | cria terminal `{ storeId, name, code, mode? }` | `settings.manage` |
| DELETE | `/api/v1/terminals/:id` | desativa terminal | `settings.manage` |

POST `/api/v1/stores`/PUT — conflito 409 `STORE_TAKEN` (code duplicado no tenant);
GET inexistente 404 `STORE_NOT_FOUND`. Auditoria: `STORE_CREATED`, `STORE_UPDATED`,
`STORE_DEACTIVATED`, `USER_STORE_GRANTED`, `USER_STORE_UPDATED`, `USER_STORE_REVOKED`,
`CASH_REGISTER_CREATED/DEACTIVATED`, `TERMINAL_CREATED/DEACTIVATED`. O campo
de configuração fiscal (`fiscalEnabled`, `fiscalSeries`, ...) é **configuração em
repouso** — nenhuma emissão ocorre no MVP.

## 3. Recursos

| Método | Rota | Descrição | Perm |
|---|---|---|---|
| GET/POST | `/api/v1/products` | listar (filtra unidade ativa)/criar produto | `products.create` (POST) |
| GET/PUT/DELETE | `/api/v1/products/:id` | consultar/atualizar/desativar (soft) | `products.update` / `products.delete` |
| GET | `/api/v1/products/barcode/:code` | resolver código de barras | autenticado |
| GET/POST | `/api/v1/products/categories` | listar/criar categorias | `products.create` (POST) |
| GET/PUT/DELETE | `/api/v1/products/categories/:id` | consultar/atualizar/desativar categoria | `products.update`/`products.delete` |
| GET/POST | `/api/v1/products/brands` | listar/criar marcas | `products.create` (POST) |
| GET/PUT/DELETE | `/api/v1/products/brands/:id` | consultar/atualizar/desativar marca | `products.update`/`products.delete` |
| PUT | `/api/v1/products/:id/stores/:storeId` | habilitar/desabilitar produto na unidade (`status` ACTIVE/INACTIVE) | `products.update` |
| GET/POST | `/api/v1/unit-measures` | listar UoM (com conversões)/criar | `products.create` (POST) |
| GET/PUT/DELETE | `/api/v1/unit-measures/:id` | consultar/atualizar/desativar UoM | `products.update`/`products.delete` |
| POST | `/api/v1/unit-measures/:id/conversions` | criar conversão (`{toUnitId, factor}`) | `products.create` |
| DELETE | `/api/v1/unit-measures/:id/conversions/:toUnitId` | remover conversão | `products.delete` |
| GET/POST | `/api/v1/customers` | clientes | `customers.manage` |
| GET/PUT/DELETE | `/api/v1/customers/:id` | consultar/atualizar/desativar (soft → INACTIVE) cliente | `customers.manage` |
| GET/POST | `/api/v1/customer-categories` | categorias de cliente | `customers.manage` |
| GET/PUT/DELETE | `/api/v1/customer-categories/:id` | consultar/atualizar/desativar categoria | `customers.manage` |
| GET | `/api/v1/pricing/price?productId=&quantity=` | resolver preço (PricingService) | autenticado |
| GET/POST | `/api/v1/price-tables` | tabelas de preço | `pricing.manage` |
| GET/POST | `/api/v1/promotions` | promoções | `pricing.manage` |
| GET | `/api/v1/inventory/balance?productId=` | saldo da unidade | autenticado |
| POST | `/api/v1/inventory/adjust` | ajuste (com motivo) | `inventory.adjust` |
| GET/POST | `/api/v1/suppliers` | fornecedores (`search`, `includeInactive`) | `purchases.manage` (POST) |
| GET/PUT/DELETE | `/api/v1/suppliers/:id` | consultar/atualizar/desativar (soft → INACTIVE) fornecedor | `purchases.manage` |
| GET/POST | `/api/v1/purchases` | pedidos de compra (`storeId`, `status`)/criar pedido | `purchases.manage` (POST) |
| GET/PUT/DELETE | `/api/v1/purchases/:id` | consultar/editar/cancelar pedido (DELETE = cancelamento) | `purchases.manage` |
| POST | `/api/v1/purchases/:id/receive` | entrada do pedido (estoque + custo/lote/validade) | `purchases.manage` |
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