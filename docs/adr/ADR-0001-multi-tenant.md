# ADR-0001 — Isolamento Multi-Tenant

**Status:** ACEITO · **Data:** 2026-09-16

## Contexto

Plataforma SaaS com múltiplos tenants (empresas) que nunca podem acessar dados uns dos
outros. Cada tenant tem múltiplas unidades (stores), e cada usuário pode operar em
diferentes unidades sem trocar de usuário.

## Decisão

1. **`tenantId` em toda entidade TenantScoped** (item-filho incluído para queries
   isoladas sem JOIN). `storeId` apenas em entidades StoreScoped (ver `DATABASE.md §2`).
2. **Contexto derivado da sessão**: `tenantId` vem do JWT (Auth.js) e é imutável na
   sessão. `storeId` é **seleção de contexto mutável**, validada por endpoint próprio
   (`POST /api/v1/session/store`) antes de emitir novo token.
3. **Isolamento primário = camada de repositório**: `TenantScopedRepository` força
   `WHERE tenantId` (e `storeId`) em toda operação; nenhum repositório aceita
   `tenantId`/`storeId` como parâmetro livre.
4. **Nunca confiar no cliente**: requisições carregam apenas identificadores de recurso;
   filtros de contexto vêm da sessão/autorização.
5. **RLS (PostgreSQL) é defesa em profundidade OPcional** — a aplicação roda 100% sem
   ela; é hardening configurável, nunca requisito de funcionamento (portabilidade
   SQL Server).

## Consequências

- Multiplos repositórios compartilham a base `TenantScopedRepository` com helpers
  `scope()`/`scopeStore()` → reduz risco de esquecer o filtro.
- Troca de unidade exige endpoint + reemissão de token (custo desprezível).
- Diversas queries precisam de índices compostos `(tenantId, ...)` (Fase 20).

## Alternativas consideradas

- Tenant em schema separado por banco: rejeitada (operacional caro, complica offline e
  multi-base).
- RLS como mecanismo principal: rejeitada por depender de feature PostgreSQL
  (inviável na portabilidade para SQL Server) — ADR-0005.
- Confiar em `tenantId` enviado pelo cliente: rejeitada (0 segurança).