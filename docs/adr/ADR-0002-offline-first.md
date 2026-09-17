# ADR-0002 — Offline-First

**Status:** ACEITO · **Data:** 2026-09-16

## Contexto

PDV físico (loja) precisa vender sem internet: rede cai, SEFAZ fora, gateway fora.
Nada pode bloquear a venda; reenvio não pode duplicar.

## Decisão

1. **Venda local-first**: operação é criada no device (PWA + IndexedDB/Dexie) e
   sincronizada depois. Cache particionado por `tenantId:storeId:deviceId`.
2. **Idempotência obrigatória**: toda operação crítica carrega `clientOperationId`
   (uuid v4 gerado no device); servidor garante unicidade
   `(tenantId, clientOperationId)` → retry nunca duplica.
3. **SyncQueue** (server) + `pendingOps` (local, com retry e estados
   PENDING/PROCESSING/SYNCED/FAILED/CONFLICT). Conflitos preservam vendas e geram
   `SyncConflict`.
4. **Controle de atualização do PWA**: nunca atualizar durante venda ativa.
5. **Saldo de estoque offline** com flag `stale`; validação final no servidor por
   balance atômico.

## Consequências

- Vendas offline concorrentes podem causar conflito de estoque → política de resolução
  por histórico de movimentações + alerta (ver `SYNC.md §5`, `DATABASE.md §5`).
- Todo endpoint de escrita precisa suportar payload enfileirável e idempotente.

## Alternativas

- Requerer conexão para vender: rejeitada (requisito offline-first).
- Duplicar por falta de idempotência: inaceitável.