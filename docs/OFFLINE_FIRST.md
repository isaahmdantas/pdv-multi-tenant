# OFFLINE-FIRST

> ADR: `docs/adr/ADR-0002`. PDV produtivo sem internet, com sincronização segura.

## 1. Princípios

1. A venda é criada localmente primeiro (offline-first), depois sincronizada.
2. Dados offline são **particionados** por `tenantId:storeId:deviceId` — nunca misturar.
3. Toda operação crítica carrega `clientOperationId` (uuid gerado no device) →
   idempotência no servidor (ADR-0002).
4. Nenhuma atualização de PWA durante venda em andamento.
5. Cache armazena **apenas** o necessário: produtos ativos da unidade, preços aplicáveis,
   categorias, clientes relevantes, UoM, configurações.

## 2. Camadas

```
Service Worker (rede + cache apropriado por rota)
   │
IndexedDB (Dexie) ── tabelas: products, prices, customers, categories, config,
│                    pendingOps, syncMeta, cart(efêmera)
├── operação online → API direta
└── operação offline → grava em pendingOps → SyncService
```

## 3. Dados offline (cache)

| Tabela local | Conteúdo | Campo de parte |
|---|---|---|
| products | produtos ativos na unidade (com preço efetivo resolvido) | tenantId, storeId |
| prices | tabelas/preços aplicáveis à unidade | tenantId, storeId |
| customers | clientes frequentes/recentes | tenantId |
| categories | categorias de produto/cliente | tenantId |
| config | configuração da unidade/tenant | tenantId, storeId |
| pendingOps | operações a sincronizar | tenantId, storeId, deviceId |

Logout → limpa cache do tenant atual. Login de outro tenant → dados antigos nunca
disponíveis (verificação no boot).

## 4. Estratégia de escrita offline

1. Monta operação com `clientOperationId`.
2. Persiste em `pendingOps` (IndexedDB) com tentativas.
3. Notifica UI (indicador "salvo localmente").
4. Quando online: `SyncService` envia em lote (ver `SYNC.md`).
5. Sucesso → remove da fila; falha persistente → `FAILED` + `SyncConflict` quando
   necessário. Vendas **nunca** são apagadas por rejeição de sincronização.

## 5. Controles de atualização do PWA

- Service Worker com "update silently no idle": atualização baixada e aplicada apenas
  quando **nenhuma venda ativa** (estado sinalizado pela UI).
- `skipWaiting` + `clients.claim` controlados: fila de espera até venda finalizar.

## 6. Métricas de salvaguarda

- Estoque offline usa saldo local, com flag `stale` quando cache antigo; venda offline
  acima do saldo local exige confirmação e será validada no servidor por estoque real
  (conflito → `SyncConflict` / ajuste supervisionado).

## 7. Testes (F13-13)

- Venda completa com rede desligada → persiste local → conecta → sincroniza sem duplicar.
- Troca de tenant no device → dados do tenant anterior inacessíveis.
- Atualização do PWA durante venda ativa → bloqueada.
- Retry de operação → `clientOperationId` idêntico → servidor não duplica.