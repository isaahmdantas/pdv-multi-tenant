# SYNC — Sincronização

> ADR: `docs/adr/ADR-0002`. Pull incremental + push idempotente por fila.

## 1. Modelo

**SyncQueue** (servidor) — registro de cada operação recebida/pendente:

```
id, tenantId, storeId, deviceId,
operation,            // CREATE | UPDATE | DELETE | REPLACE
entity,               // sale | product | stock_movement | customer | ...
entityId,
payload (Json),
clientOperationId,    // único por tenant (idempotência)
status,               // PENDING | PROCESSING | SYNCED | FAILED | CONFLICT
attempts, lastError,
createdAt, syncedAt, updatedAt
```

Unique: `(tenantId, clientOperationId)` → reenvio não duplica (entra como PROCESSING ou
retorna o resultado já aplicado).

**pendingOps** (IndexedDB) — espelho local da fila no device.

## 2. Push (device → servidor)

`POST /api/v1/sync` com `{ deviceId, ops: [...] }`.

Servidor, por op, em transação:
1. Valida sessão (tenantId) e permission (`settings.manage` ou operação permitida).
2. `clientOperationId` já existe → responde resultado original (**idempotente**, 200/409
   conforme estado original; nunca duplica).
3. Senão: cria `SyncQueue(PENDING)`, aplica `operation` no domínio (via Service — inclui
   auditoria), marca `SYNCED`.
4. Falha de validação de regra → `FAILED` + mensagem; conflito → `CONFLICT` + grava
   `SyncConflict` (payload + operação).

Resposta: por-op `{ clientOperationId, status, entityId?, error? }`.

## 3. Pull (servidor → device)

`GET /api/v1/sync?since=<updatedAtCursor>&entity=...` (filtrado por tenantId; storeId
quando a entidade é store-scoped). Retorna registros com `updatedAt > cursor` em páginas
(`nextCursor`). Dispositivo aplica no IndexedDB respeitando a partição
`tenantId:storeId:deviceId` e atualiza o cursor.

## 4. Idempotência e retry

- `clientOperationId` = uuid v4 gerado **no device** na criação da operação.
- Retry é livre; servidor responde com resultado da operação original.
- Estados: `PENDING → PROCESSING → SYNCED | FAILED | CONFLICT`; `attempts` limita retries
  automáticos (ex.: 5), depois fica para intervenção visível (UI lista pendências).

## 5. Conflitos

`SyncConflict { id, tenantId, entity, entityId, clientOperationId, remotePayload,
localPayload, status(OPEN|RESOLVED), createdAt }`.

Política:
- **Vendeda offline**: preservada; conflito de estoque → recalcula saldo pelo histórico
  de movimentações (ver DATABASE.md §5), alerta ao gestor.
- Preço: versão da venda gravada prevalece; novas consultas usam preço atual.
- Produto/cliente/config: resolve por `updatedAt` mais recente (documentado), com
  registro do conflito para auditoria.

## 6. Gatilhos

- Automático: `online` event + intervalos (ex.: 15s) + após cada operação.
- Manual: botão "sincronizar agora".
- Toda sincronização bem-sucedida atualiza `Terminal.lastSync`.

## 7. Segurança

- Toda chamada exige sessão válida e `tenantId` da sessão (nunca do payload).
- `deviceId` deve corresponder a `Terminal`/`Device` do tenant+store do usuário.
- Rate limiting em `/api/v1/sync` (prevenir replay/abuso).

## 8. Testes (F13-10/11, F19-10/11)

- Push duplicado (mesmo clientOperationId) → 1 registro, 1 venda.
- Pull cursor avançando em páginas sem perder/duplicar itens.
- Venda offline preservada quando produto foi alterado no servidor.
- Conflito de estoque gera `SyncConflict` e não apaga venda.