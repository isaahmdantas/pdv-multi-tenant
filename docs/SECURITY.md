# SECURITY

## 1. Modelo de ameaças (recorte MVP)

- Vazamento entre tenants / entre unidades do mesmo tenant.
- Replay/duplicação (offline: hash/cientes da operação).
- Injeção SQL (mitigada por Prisma + params); XSS (React + sanitização + CSP).
- Abuso de endpoint público (rate limiting em auth/sync).
- Escalação de permissão (checks server-side, nunca só UI).

## 2. Autenticação (F3, F18-01)

Auth.js v5, credenciais (email/senha), senha com hash **argon2** (bcrypt fallback), JWT
com estratégia `jwt` e cookie httpOnly. Itens da sessão: sub, tenantId, storeId,
role, permissions (ver MULTI_TENANT.md §4).

Implementado na Fase 3:
- `POST /api/v1/auth/login` — login próprio (Auth.js usado p/ custódia do cookie e
  `authorized` no proxy), salt dos JWE = **nome do cookie** (`authjs.session-token`/
  `__Secure-authjs.session-token`), `AUTH_SECRET` obrigatório. Resposta define cookie
  httpOnly, sameSite=lax, path=/, maxAge 30 dias.
- Rate limiting em `/api/v1/auth/*`: janela deslizante in-memory (`lib/api/rate-limit.ts`),
  5/min por IP com `Retry-After` (429 `RATE_LIMITED`). Trocar por store compartilhada em produção.
- Mensagem única de erro (`INVALID_CREDENTIALS`) — não vaza existência de e-mail/tenant.
- Auditoria: `LOGIN`, `LOGOUT`, `STORE_SWITCHED` (antes/depois), `ROLE_CREATED`, `USER_CREATED`.

## 3. Autorização (F18-02)

Permissões `recurso.acao`. Catálogo inicial:

```
sales.create  sales.cancel  sales.discount  sales.refund
cash.open  cash.close  cash.withdraw  cash.supply
products.create  products.update  products.delete
inventory.adjust  inventory.transfer
fiscal.issue  fiscal.cancel
reports.view  settings.manage
pricing.manage  customers.manage
```

Helper `authorize(ctx, 'sales.create')` lança `403`. Regra única de resolução role
global × role da unidade (ver MULTI_TENANT.md §6). Log de `USER_PERMISSION_CHANGED`.

## 4. Multi-tenant (F18-03)

Conforme MULTI_TENANT.md — o ponto central: contexto da sessão forçado em todo query;
nunca aceitar `tenantId`/`storeId` do cliente.

## 5. Rate limiting (F18-04)

- `/api/v1/auth/*` e `/api/v1/sync` com janela deslizante (in-memory p/ MVP, Redis
  futuro); resposta `429` com `Retry-After`.

## 6. Validação e sanitização (F18-05)

- Zod em 100% das rotas mutáveis; erro 400 com detalhes sem expor stack.
- Saída JSON serializada com `BigInt`/`Decimal` tratados (nunca expor objetos internos).
- CSP básica; headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- Entrada de busca: normalização (trim/NFD para caracteres acentuados).

## 7. Auditoria (F18-06, F2-08)

`AuditLog { tenantId, storeId?, userId, action, entity, entityId, before(Json), after(Json), timestamp, ip, device }`.

Ações: LOGIN, LOGOUT, STORE_SWITCHED, SALE_CREATED, SALE_CANCELLED, ITEM_CANCELLED,
DISCOUNT_APPLIED, PRICE_CHANGED, PRODUCT_CREATED, PRODUCT_UPDATED, STOCK_ADJUSTED,
CASH_OPENED, CASH_CLOSED, CASH_WITHDRAWAL, CASH_SUPPLY, FISCAL_ISSUED,
FISCAL_CANCELLED, USER_PERMISSION_CHANGED, USER_CREATED, ROLE_CREATED,
STORE_CREATED, STORE_UPDATED, STORE_DEACTIVATED, USER_STORE_GRANTED,
USER_STORE_UPDATED, USER_STORE_REVOKED, CASH_REGISTER_CREATED,
CASH_REGISTER_DEACTIVATED, TERMINAL_CREATED, TERMINAL_DEACTIVATED,
PRICING_CHANGED, CUSTOMER_CATEGORY_CHANGED.

`before/after` limitados (sem dados sensíveis), gravados na mesma transação do evento.

## 8. Logs (F18-07)

Logger estruturado (JSON) com `requestId`; sem segredos. Erros de validação e
isolamento (tentativa cross-tenant) logados com alerta.

## 9. Offline (F18-08)

- IndexedDB particionado; limpeza no logout; operações assinadas pelo device via
  `clientOperationId` + tenantId (ver OFFLINE_FIRST/SYNC).
- Service Worker serve apenas assets públicos (nunca dados privados por rede).

## 10. Regras globais

- Nunca confiar no frontend (igual backend).
- Decimal em todo dinheiro; arredondamento monetário (2 casas) aplicado no domínio.
- Segredos apenas em `.env` (gitignored).
- Dependências auditadas (`npm audit` na CI).