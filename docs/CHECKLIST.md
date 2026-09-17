# CHECKLIST MASTER — fonte oficial de progresso

> Formato de status (obrigatório):
> `⬜ NÃO INICIADO` · `🟡 EM ANDAMENTO` · `✅ CONCLUÍDO` · `❌ BLOQUEADO` · `🔴 COM ERRO`
>
> Colunas: **ID** · **Item** · **Status** · **Dependências** · **Arquivos** · **Validação** · **Obs**
> Regra: nunca marcar `✅` apenas porque código foi criado — a validação precisa existir
> (UI + API + regra + banco + segurança + multi-tenant + auditoria + testes + offline, qdo aplicável).
> A numeração das fases é fixa (Prompt Mestre); agrupamentos vivem no `ROADMAP.md`.

## FASE 0 — PLANEJAMENTO

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F0-01 | Analisar requisitos | ✅ | - | `docs/SPEC.md` | revisada | - |
| F0-02 | Identificar ambiguidades | ✅ | F0-01 | `docs/SPEC.md` `docs/CHECKLIST.md` | revisada | ajustes solicitados incorporados |
| F0-03 | Definir arquitetura multi-tenant | ✅ | F0-02 | `docs/MULTI_TENANT.md` `adr/ADR-0001` | revisada | tenant unidade = contexto mutável |
| F0-04 | Definir isolamento de dados | ✅ | F0-03 | `docs/MULTI_TENANT.md` `docs/DATABASE.md` | revisada | RLS opcional, nunca primário |
| F0-05 | Definir módulos | ✅ | F0-01 | `docs/ARCHITECTURE.md` | revisada | - |
| F0-06 | Definir modelo de dados | ✅ | F0-04 | `docs/DATABASE.md` | revisada | classificação Tenant/Store/Global |
| F0-07 | Definir estratégia de preços | ✅ | F0-06 | `docs/PRICING.md` `adr/ADR-0003` | revisada | prioridade única documentada |
| F0-08 | Definir estratégia offline | ✅ | F0-07 | `docs/OFFLINE_FIRST.md` `adr/ADR-0002` | revisada | - |
| F0-09 | Definir sincronização | ✅ | F0-08 | `docs/SYNC.md` | revisada | idempotência via clientOperationId |
| F0-10 | Definir fiscal | ✅ | - | `docs/FISCAL.md` `adr/ADR-0004` | revisada | NoopProvider; SEFAZ ❌ BLQ |
| F0-11 | Definir SQL Server | ✅ | - | `docs/DATABASE.md` `adr/ADR-0005` | revisada | portabilidade desde o modelo |
| F0-12 | Definir testes | ✅ | - | `docs/SPEC.md` `docs/SECURITY.md` | revisada | isolamento+preço+concorrência |
| F0-13 | PaymentProvider (abstração) | ✅ | F0-10 | `docs/PAYMENTS.md` | revisada | gateways reais ❌ BLQ |
| F0-14 | Concorrência de estoque | ✅ | F0-06 | `docs/DATABASE.md` `docs/MULTI_TENANT.md` | revisada | optimistic, sem SELECT FOR UPDATE |

## FASE 1 — FUNDAÇÃO

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F1-01 | Next.js (App Router) | ✅ | F0 | `package.json`, `src/app/*` | `npm run build` | Next 16.3.5 (Turbopack) |
| F1-02 | TypeScript | ✅ | F1-01 | `tsconfig.json` | `npm run typecheck` | strict: true, alias `@/*` |
| F1-03 | Tailwind CSS | ✅ | F1-01 | `globals.css`, `postcss.config.mjs` | build ok | Tailwind v4 (@tailwindcss/postcss) |
| F1-04 | shadcn/ui | ✅ | F1-03 | `components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts` | build ok | CLI shadcn 4.21, preset base-nova |
| F1-05 | Prisma | ✅ | F1-01 | `prisma/schema.prisma`, `prisma.config.ts`, `src/generated/prisma` | `npx prisma generate` | Prisma 7.10.0, generator `prisma-client`, driver adapter `@prisma/adapter-pg`, url em `prisma.config.ts` |
| F1-06 | PostgreSQL (db `pdv`) | ✅ | F1-05 | `scripts/check-db.ts`, `.env` | `tsx scripts/check-db.ts` SELECT 1 | db `pdv` criado; Postgres 18.4 local (Homebrew, 5432) |
| F1-07 | Environment/`.env` | ✅ | F1-01 | `.env`, `.env.example` | app lê DATABASE_URL | `.env` gitignored, `.env.example` versionado |
| F1-08 | Lint | ✅ | F1-02 | `eslint.config.mjs` | `npm run lint` | eslint-config-next (web-vitals + ts), ignora `src/generated` |
| F1-09 | Testes (Vitest) | ✅ | F1-02 | `vitest.config.ts`, `src/test/*` | `npm test` | Vitest 4 + jsdom + testing-library; 1 teste smoke ✅ |
| F1-10 | Arquitetura modular | ✅ | F1-01 | `src/lib/prisma.ts`, `src/test` | - | estrutura `src/app`, `src/lib` etc.; módulos por domínio nas próximas fases |

## FASE 2 — MULTI-TENANT

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F2-01 | Tenant | ✅ | F1 | `prisma/schema.prisma` `migration f2_multi_tenant` | `npx prisma migrate dev` | models Tenant, Store, User, Role, Permission, RolePermission, UserRole, UserStore, AuditLog |
| F2-02 | Contexto do tenant | ✅ | F2-01 | `src/modules/tenant/domain/tenant-context.ts` | tests unit multi-tenant | TenantContext (tenantId fixo; storeId de contexto mutável); F3 conecta Auth.js |
| F2-03 | Isolamento | ✅ | F2-02 | `src/modules/tenant/repositories/tenant-scoped-repository.ts` | tests integração A×B | `scope()`/`scopeStore()`; tenantId/storeId nunca do cliente |
| F2-04 | Middleware | ✅ | F2-02 | `src/lib/api/guards.ts` `src/lib/session.ts` | unit `withApiGuards` 401 | camada de API; `getSessionContext` é símbolo até F3 (Auth.js) |
| F2-05 | Repositories (TenantScoped) | ✅ | F2-03 | `src/modules/{tenant,iam,audit}/repositories/*` | tests integração | nenhum método aceita tenantId/storeId |
| F2-06 | Autorização | ✅ | F2-05 | `src/modules/iam/services/authorization-service.ts` `src/modules/iam/permissions.ts` | unit resolve/authorize | role-da-unidade vence role global; catálogo por tenant (SECURITY.md) |
| F2-07 | Testes de isolamento (A×B) | ✅ | F2-05 | `src/test/integration/isolation.test.ts` | `npm test` (23/23) | 2 tenants distintos; 404/403 cruzados; exige `pdv_test` |
| F2-08 | Auditoria | ✅ | F2-01 | `src/modules/audit/*` | teste integração auditoria | AuditLog tenantId+storeId; USER_CREATED/STORE_SWITCHED prontos |

## FASE 3 — AUTENTICAÇÃO

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F3-01 | Usuários | ✅ | F2 | `src/app/api/v1/users/route.ts`, `UserService` | `npm test` + curl POST/GET | argon2; 409 EMAIL_TAKEN; roles+unidades na transação |
| F3-02 | Login | ✅ | F3-01 | `src/app/api/v1/auth/login/route.ts`, `AuthenticationService` | curl + teste integração | 5/min/IP (429); INVALID_CREDENTIALS/INACTIVE_USER/MULTIPLE_TENANTS; audit LOGIN |
| F3-03 | Logout | ✅ | F3-02 | `src/app/api/v1/auth/logout/route.ts` | curl (cookie limpo) | audit LOGOUT |
| F3-04 | Sessão (tenant + unidade atual) | ✅ | F3-02 | `src/lib/session.ts`, `src/lib/session-cookies.ts`, `GET /api/v1/session` | teste unit (getToken) + curl | JWT JWE httpOnly; storeId = seleção, não identidade |
| F3-05 | Roles | ✅ | F3-01 | `src/app/api/v1/roles/route.ts`, `RoleService/RoleRepository` | teste + curl | `Role.globalStoreAccess`; 409 ROLE_TAKEN; audit ROLE_CREATED |
| F3-06 | Permissions | ✅ | F3-05 | `src/app/api/v1/permissions/route.ts`, `PERMISSIONS` | curl | catálogo 19 permissões; `isValidPermissionCode` |
| F3-07 | Proteção de rotas | ✅ | F3-04 | `src/proxy.ts` (Next 16: exports `proxy`), `authorized` callback | curl /dashboard sem cookie → 307 /login | Sem `...nextauth` para login; páginas protegidas exceto `/`, `/login`, `/api/*`, estáticos |
| F3-08 | Troca de unidade sem logout | ✅ | F3-04, F4-03 | `src/app/api/v1/session/store/route.ts`, `StoreSwitchService.authorizeSwitch` | curl + teste integração | revalida UserStore/role no banco; reemite JWT; audit STORE_SWITCHED (before/after) |

## FASE 4 — UNIDADES DA EMPRESA

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F4-01 | Cadastro (Store) | ⬜ | F2 | - | - | - |
| F4-02 | Configuração da unidade | ⬜ | F4-01 | - | - | - |
| F4-03 | Usuários por unidade (UserStore) | ⬜ | F4-01, F3 | - | - | - |
| F4-04 | Estoque por unidade | ⬜ | F4-01 | - | - | - |
| F4-05 | Caixas | ⬜ | F4-01 | - | - | - |
| F4-06 | Terminais | ⬜ | F4-01 | - | - | - |
| F4-07 | Configuração fiscal por unidade | ⬜ | F4-02 | - | - | - |

## FASE 5 — PRODUTOS

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F5-01 | Categorias de produto | ⬜ | F2 | - | - | - |
| F5-02 | Marcas | ⬜ | F5-01 | - | - | - |
| F5-03 | Produtos | ⬜ | F5-01 | - | - | - |
| F5-04 | SKU | ⬜ | F5-03 | - | - | - |
| F5-05 | Código de barras | ⬜ | F5-03 | - | - | - |
| F5-06 | Unidades de medida (UoM) | ⬜ | F5-03 | - | - | - |
| F5-07 | Conversões de unidade | ⬜ | F5-06 | - | - | - |
| F5-08 | Produtos por unidade (ProductStore) | ⬜ | F5-03, F4 | - | - | - |
| F5-09 | Campos fiscais do produto | ⬜ | F5-03 | - | - | - |

## FASE 6 — CLIENTES

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F6-01 | Clientes | ⬜ | F2 | - | - | - |
| F6-02 | Categorias de cliente | ⬜ | F6-01 | - | - | - |
| F6-03 | Cliente por categoria | ⬜ | F6-02 | - | - | - |
| F6-04 | Histórico | ⬜ | F6-01 | - | - | - |
| F6-05 | Limite | ⬜ | F6-01 | - | - | - |
| F6-06 | Fidelidade (preparada) | ⬜ | F6-01 | - | - | - |

## FASE 7 — PREÇOS

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F7-01 | PriceTable | ⬜ | F2 | - | - | - |
| F7-02 | ProductPrice | ⬜ | F7-01 | - | - | - |
| F7-03 | Preço padrão do produto | ⬜ | F7-02, F5 | - | - | - |
| F7-04 | Preço por unidade | ⬜ | F7-02, F4 | - | - | - |
| F7-05 | Preço por categoria de cliente | ⬜ | F7-02, F6 | - | - | - |
| F7-06 | Preço unidade + categoria | ⬜ | F7-02 | - | - | - |
| F7-07 | Preço por quantidade | ⬜ | F7-02 | - | - | - |
| F7-08 | Promoções | ⬜ | F7-02 | - | - | - |
| F7-09 | Prioridade (constante única) | ⬜ | F7-01 | - | - | - |
| F7-10 | PricingService | ⬜ | F7-09 | - | - | - |
| F7-11 | Testes do motor de preços | ⬜ | F7-10 | - | - | - |

## FASE 8 — ESTOQUE

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F8-01 | StockBalance | ⬜ | F2, F5 | - | - | - |
| F8-02 | StockMovement | ⬜ | F8-01 | - | - | - |
| F8-03 | Entradas | ⬜ | F8-02 | - | - | - |
| F8-04 | Saídas | ⬜ | F8-02 | - | - | - |
| F8-05 | Ajustes | ⬜ | F8-02 | - | - | - |
| F8-06 | Inventário | ⬜ | F8-02 | - | - | - |
| F8-07 | Transferências entre unidades | ⬜ | F8-02, F4 | - | - | - |
| F8-08 | Estoque mínimo | ⬜ | F8-01, F5 | - | - | - |
| F8-09 | Estoque máximo | ⬜ | F8-01, F5 | - | - | - |
| F8-10 | Alertas | ⬜ | F8-08, F8-09 | - | - | - |
| F8-11 | Concorrência (optimistic/atômico) | ⬜ | F8-01 | - | - | - |

## FASE 9 — COMPRAS

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F9-01 | Fornecedores | ⬜ | F2 | - | - | - |
| F9-02 | Pedido de compra | ⬜ | F9-01 | - | - | - |
| F9-03 | Entrada | ⬜ | F9-02 | - | - | - |
| F9-04 | Custo | ⬜ | F9-03 | - | - | - |
| F9-05 | Lote | ⬜ | F9-03 | - | - | - |
| F9-06 | Validade | ⬜ | F9-03 | - | - | - |
| F9-07 | Integração estoque | ⬜ | F9-03, F8 | - | - | - |

## FASE 10 — CAIXA

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F10-01 | Cadastro (CashRegister) | ⬜ | F4 | - | - | - |
| F10-02 | Abertura | ⬜ | F10-01 | - | - | - |
| F10-03 | Suprimento | ⬜ | F10-02 | - | - | - |
| F10-04 | Sangria | ⬜ | F10-02 | - | - | - |
| F10-05 | Movimentações | ⬜ | F10-03, F10-04 | - | - | - |
| F10-06 | Fechamento | ⬜ | F10-02 | - | - | - |
| F10-07 | Conferência | ⬜ | F10-06 | - | - | - |
| F10-08 | Diferença (sobra/falta/exato) | ⬜ | F10-07 | - | - | - |
| F10-09 | Relatório de caixa | ⬜ | F10-06 | - | - | - |

## FASE 11 — PDV

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F11-01 | Tela PDV | ⬜ | F3 | - | - | - |
| F11-02 | Busca de produto | ⬜ | F11-01, F5 | - | - | - |
| F11-03 | Código de barras | ⬜ | F11-01, F5 | - | - | - |
| F11-04 | Carrinho | ⬜ | F11-01 | - | - | - |
| F11-05 | Quantidade | ⬜ | F11-04 | - | - | - |
| F11-06 | Cliente | ⬜ | F11-04, F6 | - | - | - |
| F11-07 | Seleção de preço (PricingService) | ⬜ | F11-04, F7 | - | - | - |
| F11-08 | Desconto | ⬜ | F11-04 | - | - | - |
| F11-09 | Cancelamento | ⬜ | F11-04 | - | - | - |
| F11-10 | Suspensão | ⬜ | F11-04 | - | - | - |
| F11-11 | Recuperação | ⬜ | F11-10 | - | - | - |
| F11-12 | Pagamento | ⬜ | F11-04, F12 | - | - | - |
| F11-13 | Troco | ⬜ | F11-12 | - | - | - |
| F11-14 | Finalização | ⬜ | F11-12 | - | - | - |

## FASE 12 — PAGAMENTOS

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F12-01 | Dinheiro | ⬜ | F11 | - | - | - |
| F12-02 | PIX | ⬜ | F11 | - | - | - |
| F12-03 | Crédito | ⬜ | F11 | - | - | - |
| F12-04 | Débito | ⬜ | F11 | - | - | - |
| F12-05 | Voucher | ⬜ | F11 | - | - | - |
| F12-06 | Múltiplos pagamentos | ⬜ | F12-01..05 | - | - | - |
| F12-07 | Estorno | ⬜ | F12-06 | - | - | - |
| F12-08 | Histórico | ⬜ | F12-06 | - | - | - |

## FASE 13 — OFFLINE-FIRST

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F13-01 | PWA | ⬜ | F1 | - | - | - |
| F13-02 | Manifest | ⬜ | F13-01 | - | - | - |
| F13-03 | Service Worker | ⬜ | F13-01 | - | - | - |
| F13-04 | IndexedDB (Dexie) | ⬜ | F13-01 | - | - | - |
| F13-05 | Cache | ⬜ | F13-03 | - | - | - |
| F13-06 | Dados offline particionados | ⬜ | F13-04 | - | - | tenantId+storeId+deviceId |
| F13-07 | SyncQueue | ⬜ | F13-04, F2 | - | - | - |
| F13-08 | Idempotência (clientOperationId) | ⬜ | F13-07 | - | - | - |
| F13-09 | Retry | ⬜ | F13-07 | - | - | - |
| F13-10 | Sincronização automática | ⬜ | F13-07 | - | - | - |
| F13-11 | Conflitos | ⬜ | F13-10 | - | - | - |
| F13-12 | Indicador online/offline | ⬜ | F13-03 | - | - | - |
| F13-13 | Testes offline | ⬜ | F13-10 | - | - | - |

## FASE 14 — FISCAL

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F14-01 | FiscalService | ⬜ | F11, F2 | - | - | - |
| F14-02 | FiscalProvider | ⬜ | F14-01 | - | - | - |
| F14-03 | NFC-e | ❌ | F14-02 | - | - | BLQ: SEFAZ/credenciais |
| F14-04 | NF-e | ❌ | F14-02 | - | - | BLQ: SEFAZ/credenciais |
| F14-05 | XML | ❌ | F14-03 | - | - | BLQ |
| F14-06 | Eventos | ⬜ | F14-01 | - | - | - |
| F14-07 | Cancelamento | ❌ | F14-02 | - | - | BLQ |
| F14-08 | Rejeições | ⬜ | F14-01 | - | - | - |
| F14-09 | Contingência | ⬜ | F14-02 | - | - | - |
| F14-10 | Reprocessamento | ⬜ | F14-09 | - | - | - |
| F14-11 | Histórico fiscal | ⬜ | F14-01 | - | - | - |

## FASE 15 — AUTOATENDIMENTO

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F15-01 | Terminal (mode SELF_CHECKOUT) | ⬜ | F4 | - | - | - |
| F15-02 | Modo self-checkout | ⬜ | F15-01 | - | - | - |
| F15-03 | Touchscreen | ⬜ | F15-02 | - | - | - |
| F15-04 | Scanner | ⬜ | F15-02 | - | - | - |
| F15-05 | Carrinho | ⬜ | F15-02 | - | - | - |
| F15-06 | Pagamento | ⬜ | F15-05, F12 | - | - | - |
| F15-07 | Finalização | ⬜ | F15-06 | - | - | - |
| F15-08 | Chamada de funcionário | ⬜ | F15-02 | - | - | - |
| F15-09 | Offline | ⬜ | F15-02, F13 | - | - | - |

## FASE 16 — RELATÓRIOS

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F16-01 | Vendas | ⬜ | F11 | - | - | - |
| F16-02 | Produtos | ⬜ | F5 | - | - | - |
| F16-03 | Estoque | ⬜ | F8 | - | - | - |
| F16-04 | Caixa | ⬜ | F10 | - | - | - |
| F16-05 | Pagamentos | ⬜ | F12 | - | - | - |
| F16-06 | Clientes | ⬜ | F6 | - | - | - |
| F16-07 | Fornecedores | ⬜ | F9 | - | - | - |
| F16-08 | Fiscal | ⬜ | F14 | - | - | - |
| F16-09 | Exportações (PDF/Excel/CSV) | ⬜ | F16-01..08 | - | - | - |

## FASE 17 — DASHBOARD / INTELIGÊNCIA

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F17-01 | Dashboard | ⬜ | F16 | - | - | - |
| F17-02 | KPIs | ⬜ | F17-01 | - | - | - |
| F17-03 | Alertas | ⬜ | F17-01, F8-10 | - | - | - |
| F17-04 | Produtos parados | ⬜ | F17-01 | - | - | - |
| F17-05 | Ruptura/estoque baixo | ⬜ | F17-01, F8 | - | - | - |
| F17-06 | Sugestão de compra | ⬜ | F17-05 | - | - | - |
| F17-07 | Análise de vendas | ⬜ | F17-01 | - | - | - |
| F17-08 | Análise de caixa | ⬜ | F17-01, F10 | - | - | - |
| F17-09 | Análise por unidade | ⬜ | F17-01 | - | - | - |
| F17-10 | Análise por categoria de cliente | ⬜ | F17-01 | - | - | - |

## FASE 18 — SEGURANÇA

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F18-01 | Autenticação | ⬜ | F3 | - | - | - |
| F18-02 | Autorização | ⬜ | F3 | - | - | - |
| F18-03 | Multi-tenant | ⬜ | F2 | - | - | - |
| F18-04 | Rate limiting | ⬜ | F3 | - | - | - |
| F18-05 | Validação (Zod) | ⬜ | F1 | - | - | - |
| F18-06 | Auditoria | ⬜ | F2-08 | - | - | - |
| F18-07 | Logs | ⬜ | F18-06 | - | - | - |
| F18-08 | Segurança offline | ⬜ | F13 | - | - | - |

## FASE 19 — TESTES

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F19-01 | Unitários | 🟡 | F1-09 | - | - | framework Vitest |
| F19-02 | Integração | ⬜ | F19-01 | - | - | - |
| F19-03 | E2E | ⬜ | F19-02 | - | - | - |
| F19-04 | Multi-tenant | ⬜ | F2 | - | - | obrigatório |
| F19-05 | Preços | ⬜ | F7 | - | - | - |
| F19-06 | Caixa | ⬜ | F10 | - | - | - |
| F19-07 | Estoque | ⬜ | F8 | - | - | - |
| F19-08 | PDV | ⬜ | F11 | - | - | - |
| F19-09 | Offline | ⬜ | F13 | - | - | - |
| F19-10 | Sincronização | ⬜ | F13 | - | - | - |
| F19-11 | Idempotência | ⬜ | F13-08 | - | - | - |
| F19-12 | Concorrência | ⬜ | F8-11 | - | - | - |

## FASE 20 — PERFORMANCE

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F20-01 | Frontend | ⬜ | F1 | - | - | - |
| F20-02 | PDV | ⬜ | F11 | - | - | - |
| F20-03 | Cache | ⬜ | F13-05 | - | - | - |
| F20-04 | Banco | ⬜ | F5 | - | - | - |
| F20-05 | Índices | ⬜ | F2 | - | - | - |
| F20-06 | Queries | ⬜ | F20-05 | - | - | - |
| F20-07 | Offline | ⬜ | F13 | - | - | - |
| F20-08 | Sincronização | ⬜ | F13-10 | - | - | - |

## FASE 21 — DOCUMENTAÇÃO

| ID | Item | Status | Deps | Arquivos | Validação | Obs |
|---|---|---|---|---|---|---|
| F21-01 | README | ⬜ | F1 | - | - | - |
| F21-02 | ARCHITECTURE | ✅ | F0 | `docs/ARCHITECTURE.md` | revisada | - |
| F21-03 | DATABASE | ✅ | F0 | `docs/DATABASE.md` | revisada | - |
| F21-04 | MULTI_TENANT | ✅ | F0 | `docs/MULTI_TENANT.md` | revisada | - |
| F21-05 | PRICING | ✅ | F0 | `docs/PRICING.md` | revisada | - |
| F21-06 | OFFLINE_FIRST | ✅ | F0 | `docs/OFFLINE_FIRST.md` | revisada | - |
| F21-07 | SYNC | ✅ | F0 | `docs/SYNC.md` | revisada | - |
| F21-08 | FISCAL | ✅ | F0 | `docs/FISCAL.md` | revisada | - |
| F21-09 | SECURITY | ✅ | F0 | `docs/SECURITY.md` | revisada | - |
| F21-10 | API | ✅ | F0 | `docs/API.md` | revisada | - |
| F21-11 | DEPLOYMENT | ⬜ | F1 | - | - | - |
| F21-12 | ADRs | ✅ | F0 | `docs/adr/ADR-0001..0005` | revisada | - |

---

## Legenda de progresso geral

- ✅ **FASE 0** — Planejamento concluído (docs + ADRs + roadmap + checklist).
- ✅ **FASE 1** — Fundação concluída (Next/Tailwind/shadcn/Prisma 7/Vitest).
- ✅ **FASE 2** — Multi-tenant concluída (models, contexto, isolamento, autorização, auditoria,
  testes A×B). Troca de unidade (rota HTTP) integra na F3 (Auth.js).
- ⬜ Demais fases — não iniciadas, conforme numeração fixa do Prompt Mestre.
- ❌ **F14-03/04/05/07** — bloqueadas por dependência externa (SEFAZ/certificado); abstrações
  serão implementadas na fase, sem simular funcionamento real.