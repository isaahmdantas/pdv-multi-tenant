# ADR-0005 — Portabilidade de Banco (PostgreSQL → SQL Server)

**Status:** ACEITO · **Data:** 2026-09-16

## Contexto

Stack inicial é PostgreSQL/Prisma, com exigência de migração futura para Microsoft SQL
Server. Regras de banco específicas criariam retrabalho e acoplamento.

## Decisão

1. **IDs**: `String @id @default(cuid())` — portável (cuid) e sem depender de UUID nativo.
2. **Dinheiro/quantidades**: sempre `Decimal` (Prisma Decimal); nunca float.
3. **Sem enums nativos**: campos de estado/tipo/permissão são `String` com uniões TS
   validadas por Zod (portável como `varchar` no SQL Server).
4. **Sem tipos/extensões PostgreSQL** (`citext`, `uuid-ossp`, etc.). Sem `Json`? → **não**:
   Prisma mapeia `Json` para `jsonb` (PG) e `nvarchar(max)` (SQL Server) — aceitável e
   portável; conteúdo sempre JSON válido.
5. **Concorrência de estoque**: **sem `SELECT ... FOR UPDATE`** e sem bloqueios
   name-based. Estratégia centralizada em `StockRepository`/`StockService`:
   - update atômico condicional com guarda de saldo não-negativo na instrução;
   - optimistic concurrency via `StockBalance.version`;
   - com fallback documentado para SQL Server.
6. **RLS nunca é requisito de funcionamento** (feature PostgreSQL) — isolamento é de
   aplicação (ADR-0001).
7. Domínio/services desconhecem SQL; apenas repositories falam com Prisma.

## Consequências

- Migração futura: trocar provider Prisma + revisar migrations, sem reescrever domínio.
- Custo: campos enum como string exigem Zod em todo boundary (já é a regra do projeto).

## Alternativas

- UUID nativo: rejeitado (variação de tipo entre bancos).
- Enums nativos: rejeitados (PG enum vs SQL Server).
- `SELECT ... FOR UPDATE`: rejeitado (semântica/transação distinta no SQL Server).