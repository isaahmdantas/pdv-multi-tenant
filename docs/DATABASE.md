# DATABASE — Modelo e Classificação de Escopo

## 1. Regras transversais (ADR-0005)

- IDs: `String @id @default(cuid())` — portável PostgreSQL ↔ SQL Server.
- Dinheiro: `Decimal` (Prisma `Decimal`), nunca float.
- **Sem enums nativos**: campos como `status`/`type`/`permission` são `String` com uniões
  TypeScript validadas por Zod. Portável para SQL Server (`varchar`).
- Datas: `DateTime` (ISO 8601). `updatedAt` preenchido para pull incremental de sync.
- Sem extensões PostgreSQL (nenhum `citext`, `uuid-ossp`, etc.).
- RLS: opcional (hardening), nunca requisito de funcionamento.
- Toda mudança em schema exige migration + validação + doc (regra do Prompt Mestre).

## 2. Classificação de escopo das entidades

Três categorias (ajuste obrigatório nº2). Entidades com `tenantId` são isoladas por
repositório. Entidades com `storeId` são subconjunto das `TenantScoped`. **Não** se
adiciona `tenantId`/`storeId` onde não faz sentido — itens-filho carregam apenas
`tenantId` para consulta segura sem JOIN; `storeId` só quando a própria linha precisa de
filtro por unidade.

### 2.1 TenantScoped — `tenantId` (nunca `storeId`)

São do tenant como um todo; consultadas sem depender de unidade.

| Entidade | tenantId | obs |
|---|---|---|
| Tenant | — (raiz) | própria raiz |
| User | ✓ | usuário do tenant |
| Role | ✓ | perfil (ADMIN, GERENTE, …); `globalStoreAccess` = acesso a todas as unidades |
| Permission | ✓ | recurso.permisso (ex.: `sales.create`) |
| UserRole | ✓ | liga User–Role |
| RolePermission | ✓ | liga Role–Permission (join explícito com `tenantId`) |
| Product | ✓ | — |
| ProductCategory | ✓ | — |
| ProductBrand | ✓ | — |
| ProductBarcode | ✓ | vários por produto |
| UnitOfMeasure | ✓ | unidade de medida (UN, KG, CX…) |
| UnitConversion | ✓ | ex.: 1 CX = 12 UN |

> **F5 (migration `f5_products`):** Product, ProductCategory, ProductBrand, ProductBarcode,
> UnitOfMeasure e UnitConversion criados conforme a tabela acima; ProductStore em §2.2.
> `Product.basePrice` (Decimal) é o fallback de preço (PRICING priority 6).

> **F9 (migration `f9_purchases`):** Supplier (TenantScoped, `@@unique[tenantId,document]`),
> Purchase (StoreScoped, `status` ORDERED→RECEIVED|CANCELLED, `totalAmount` = Σ itens) e
> PurchaseItem (item-filho, via Purchase) criados conforme as tabelas abaixo; entrada gera
> StockMovement IN com `referenceType = PURCHASE` (integração estoque F8). Ciclo completo em
> `docs/PURCHASES.md`.

> **F10 (migration `f10_cash`):** CashSession (StoreScoped, `status` OPEN→CLOSED,
> `openingAmount`/`closingAmount`/`difference` Decimal + `classification`
> EXACT|SURPLUS|SHORTAGE, ≤1 sessão OPEN por caixa) e CashMovement (item-filho via
> CashSession, `type` OPENING|SALE|SUPPLY|WITHDRAW|CLOSING|ADJUSTMENT, `methodCode`
> opcional). Fechamento grava movimento CLOSING com `amount = difference`. Ciclo completo
> em `docs/CASH.md`.

| CustomerCategory | ✓ | Varejo, Atacado, Funcionário… |
| Customer | ✓ | categoria via customerCategoryId |
| Supplier | ✓ | fornecedor (nome, RN) — `@@unique[tenantId, document]` |
| PaymentMethod | ✓ | configurável por tenant (dinheiro, PIX…) |
| PriceTable | ✓ | pode ter `storeId` opcional → ver 2.2 |
| ProductPrice | ✓ | filha de PriceTable (via priceTableId); **sem** storeId direto |
| Promotion | ✓ | — |
| Purchase | ✓ | documento de compra do tenant; storeId? sim → 2.2 |
| FiscalOperation | ✓ | operação fiscal (desacoplada da SEFAZ) |
| SyncConflict | ✓ | — |

### 2.2 StoreScoped — `tenantId` **e** `storeId`

Entidades ancoradas em uma unidade operacional da empresa.

| Entidade | tenantId | storeId | obs |
|---|---|---|---|
| Store | ✓ | — (ela é a unidade) | filha de Tenant; + document/contato/endereço/timezone e campos fiscais (fiscalState/fiscalEnvironment/fiscalEnabled/fiscalSeries) |
| UserStore | ✓ | ✓ | acesso/permissão de usuário à unidade |
| Device | ✓ | ✓ | aparelho físico |
| Terminal | ✓ | ✓ | terminal (mode: POS/SELF_CHECKOUT/ADMIN) |
| CashRegister | ✓ | ✓ | caixa físico |
| ProductStore | ✓ | ✓ | produto ativo/inativo por unidade |
| StockBalance | ✓ | ✓ | saldo = tenant+store+product (única) |
| StockMovement | ✓ | ✓ | histórico de movimentação por unidade |
| CashSession | ✓ | ✓ | sessão de caixa (aberta/fechada) |
| CashMovement | ✓ | ✓ | movimentação do caixa (venda/suprimento/…) |
| Sale | ✓ | ✓ | venda da unidade |
| Purchase | ✓ | ✓ | compra da unidade |
| Inventory | ✓ | ✓ | inventário por unidade |
| StockTransfer | ✓ | origem/destino | storeId como origem; storeDestinoId |
| PriceTable | ✓ | ✓(opcional) | storeId null = vale para o tenant inteiro |
| FiscalDocument | ✓ | ✓ | documento fiscal da unidade (futuro) |

### 2.3 Itens-filho — apenas `tenantId` (sem `storeId` direto)

Acessados sempre via pai; `tenantId` denormalizado p/ queries isoladas sem JOIN.

| Entidade | tenantId | storeId | acessada via |
|---|---|---|---|
| SaleItem | ✓ | — | Sale (storeId) |
| Payment | ✓ | — | Sale (storeId) |
| PurchaseItem | ✓ | — | Purchase |
| InventoryItem | ✓ | — | Inventory |
| FiscalEvent | ✓ | — | FiscalOperation |
| AuditLog | ✓ | ✓ | — (tem storeId opcional/qdo conhecida) |
| SyncQueue | ✓ | ✓ | fila de sincronização por device+store |

### 2.4 Global / Reference — sem `tenantId`

Dados de plataforma, não operacionais. **No MVP: nenhuma.** Tabelas de referência
(UoM, PaymentMethod, categorias) são configuráveis por tenant para permitir
customização e isolamento. Futuro: estados/UF fiscais e padronizações SEFAZ podem se
tornar referência platform-level (decisão posterior, gera ADR).

## 3. Regra de ouro por categoria

- **TenantScoped**: query sempre inclui `tenantId = ctx.tenantId`.
- **StoreScoped**: query sempre inclui `tenantId` e `storeId = ctx.storeId`.
- **Item-filho**: query sempre inclui `tenantId`; `storeId` via JOIN com o pai (ou dado
  pelo contexto quando necessário).
- **Global**: sem filtro (nenhuma no MVP).

## 4. Índices recomendados (Fase 20)

- Unique: `StockBalance(tenantId, storeId, productId)`
- Unique: `ProductBarcode(tenantId, value)`
- Unique: `SyncQueue(tenantId, clientOperationId)`
- Unique: `Supplier(tenantId, document)`
- Composto: `StockMovement(tenantId, storeId, productId, createdAt)`
- Composto: `Sale(tenantId, storeId, createdAt)`
- Composto: `Purchase(tenantId, storeId, createdAt)`
- Composto: `AuditLog(tenantId, createdAt)`
- Full (preço): `ProductPrice(priceTableId, productId)`

## 5. Concorrência de estoque (ADR-0005, ajuste nº6)

Estratégia centralizada em `StockService`/`StockRepository`:

1. **Update atômico condicional** (portável): `UPDATE StockBalance
   SET quantity = quantity + delta WHERE id = ? AND tenantId = ? AND storeId = ?
   AND quantity + delta >= 0` — verifica saldo não-negativo dentro da própria instrução.
2. **Optimistic concurrency**: `StockBalance.version` incrementado a cada alteração;
   updates com `WHERE version = ?` retornam 0 linhas → `409 CONFLICT` → grava
   `SyncConflict` e permite retry/ajuste supervisionado.
3. **Sem `SELECT ... FOR UPDATE`** e sem bloqueios nomeados PostgreSQL.
4. Venda transacional: baixa de estoque é última etapa crítica; conflito → rollback da
   venda com erro claro ao operador (nunca estoque negativo silencioso).

## 6. Conexão

- Database: `pdv` no PostgreSQL local (porta 5432, instância Evolution existente —
  apenas `CREATE DATABASE pdv`). Ambiente local hoje: PostgreSQL 18.4 (Homebrew).
- URL via `.env` (`DATABASE_URL=postgresql://...`).
- **Prisma 7** (7.10.0):
  - `datasource.url` não fica no `schema.prisma`; fica em `prisma.config.ts`
    (`defineConfig({ datasource: { url: env("DATABASE_URL") } })`).
  - Generator `prisma-client` (novo, rust-free) com `output = "../src/generated/prisma"`
    (obrigatório; `prisma-client-js` está deprecated e será removido).
  - Client em tempo de execução usa **driver adapter** `@prisma/adapter-pg` +
    `pg` (`new PrismaClient({ adapter })`), instanciado em `src/lib/prisma.ts`
    (singleton com hot-reload em dev).