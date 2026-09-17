# PDV Multi-Tenant

Sistema de Ponto de Venda profissional, multi-tenant, offline-first, preparado para
emissão fiscal, self-checkout e evolução para SaaS.

**Stack:** Next.js (App Router) · TypeScript · React · Tailwind CSS · shadcn/ui · PWA ·
IndexedDB (Dexie) · Prisma · PostgreSQL · Auth.js (NextAuth v5) · Zod · Vitest

## Documentação (fonte persistente das decisões)

| Doc | Conteúdo |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Escopo, princípios, critérios de conclusão |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fases (numeração fixa do Prompt Mestre) + agrupamentos |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | **Fonte oficial de progresso** |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Camadas e estrutura de módulos |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Modelo + classificação de escopo das entidades |
| [`docs/MULTI_TENANT.md`](docs/MULTI_TENANT.md) | Isolamento e contexto (tenant/unidade) |
| [`docs/PRICING.md`](docs/PRICING.md) | Motor de preços |
| [`docs/OFFLINE_FIRST.md`](docs/OFFLINE_FIRST.md) · [`docs/SYNC.md`](docs/SYNC.md) | Offline e sincronização |
| [`docs/FISCAL.md`](docs/FISCAL.md) · [`docs/PAYMENTS.md`](docs/PAYMENTS.md) | Fiscal e pagamentos |
| [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/API.md`](docs/API.md) | Segurança e contrato v1 |
| [`docs/adr/`](docs/adr/) | Decisões arquiteturais (ADR-0001..0005) |

## Status

Fase 0 (planejamento) ✅ · Fase 1 (fundação) 🟡 em andamento.

## Scripts

_(adicionados na Fase 1)_

## Banco

PostgreSQL local porta 5432, database `pdv` (configurado na Fase 1).