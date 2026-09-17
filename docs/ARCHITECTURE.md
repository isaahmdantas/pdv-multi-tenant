# ARCHITECTURE

## 1. Visão de camadas

```
UI (React / App Router)
   ↓
API Route Handlers (/api/v1/*)
   ↓ Zod: validação
Services (domínio)          ← regras de negócio, sem conhecer banco
   ↓
Repositories (TenantScoped) ← forçam filtro tenantId/storeId
   ↓
Prisma Client
   ↓
PostgreSQL (hoje) → SQL Server (futuro)
```

Regra: **Service não fala com Prisma**; Repository não contém regra de negócio.
Domínio é puro e não conhece detalhes do PostgreSQL.

## 2. Estrutura de diretórios

```
src/
├── app/
│   ├── api/v1/<recursos>/route.ts
│   ├── login/  dashboard/  pdv/  caixa/  produtos/  estoque/
│   ├── clientes/  fornecedores/  compras/  financeiro/  fiscal/
│   ├── relatorios/  autoatendimento/  configuracoes/
│   └── layout.tsx
├── modules/
│   ├── auth/  tenants/  users/  permissions/  stores/  devices/
│   ├── products/  pricing/  customers/  suppliers/  sales/  payments/
│   ├── cash-registers/  inventory/  purchases/  finance/  fiscal/
│   ├── self-checkout/  synchronization/  reports/  audit/
│   └── (cada módulo: domain.ts  service.ts  repository.ts  types.ts  schemas.ts)
├── components/  hooks/  services/  repositories/  schemas/
├── types/  lib/  offline/
└── test/  (unit + integração + isolation)
```

## 3. Fluxo de requisição autenticada

```
Request
 → Session (Auth.js JWT: userId, tenantId, storeId atual, role, permissions)
 → authorize() (permite true/false; lança 403)
 → TenantContext { tenantId, storeId?, userId }
 → Service (regra)
 → TenantScopedRepository (query com tenantId forcado)
 → DB
```

- `tenantId` e `storeId` **nunca** vêm do corpo/query/header do cliente.
- O handler de troca de unidade valida a permissão e emite novo token/cookie com o
  `storeId` selecionado. (ver `docs/MULTI_TENANT.md`)

## 4. Módulo típico (ex.: produto)

- `module/product/domain.ts` — entidade pura + regras.
- `product.service.ts` — orquestra (validação, preço, estoque, auditoria).
- `product.repository.ts` — herda `TenantScopedRepository`; expõe `findById(ctx, id)`
  que monta `WHERE id = ? AND tenantId = ctx.tenantId`.
- `product.schemas.ts` — schemas Zod (criar/atualizar/consultar).

## 5. Transação (venda)

```
BEGIN (Prisma $transaction)
  1. Cria Sale
  2. Cria SaleItems (unitPrice efetivo, costAtSale)
  3. Registra Payments (PaymentProvider)
  4. Baixa estoque (StockService — atômico/optimistic)
  5. Cria StockMovements
  6. Registra CashMovement no CashSession
  7. Cria AuditLog
  8. Cria FiscalOperation (PENDING)
COMMIT  (qualquer erro → ROLLBACK; venda nunca fica pela metade)
```

## 6. Abstrações de porta

| Interface | Papel | Implementação MVP |
|---|---|---|
| `FiscalProvider` | emitir/cancelar/consultar doc fiscal | `NoopFiscalProvider` (nunca simula autorização real) |
| `PaymentProvider` | capturar/estornar/consultar pagamento | providers internos (simulação local) |
| `PricingService` | resolver preço com prioridade | implementação real + testes |
| `StockService` | movimentar estoque com concorrência | atômico + optimistic concurrency |
| `PrintService` | comprovantes | gerador de texto/HTML (impressão física ❌) |
| `SyncService` | fila pull/push com idempotência | implementação real |

## 7. Direção de dependência

Módulos internos dependem de portas (interfaces). Nenhum módulo depende de outro módulo
diretamente — comunicação via serviços/portas. Isolamento do tenant é transversal
(compartilhado via `TenantContext` + `TenantScopedRepository`).

## 8. Decisões-chave

- `storeId` é **seleção de contexto**, não identidade do usuário (ADR-0001).
- Isolamento primário = camada de repositório; RLS opcional (ADR-0001).
- Money = `Decimal`; IDs = `cuid`; sem enums nativos (ADR-0005).
- Venda independe de SEFAZ/gateway/online (ADR-0002, ADR-0004).