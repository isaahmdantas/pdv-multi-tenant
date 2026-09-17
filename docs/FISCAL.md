# FISCAL — Operação Fiscal e Provider

> ADR: `docs/adr/ADR-0004`. Separação completa: **venda → operação fiscal → provider → SEFAZ**.

## 1. Cadeia de responsabilidades

```
Venda comercial (domínio)            ← existe independentemente de SEFAZ
   │  venda concluída → cria FiscalOperation
   ▼
FiscalService (opera FiscalOperation) ← transições de estado, rejeições, retry, contingência
   │
   ▼
FiscalProvider (porta/interface)      ← trocável sem tocar no domínio
   │
   ▼
Provedor externo (SEFAZ/API fiscal)   ← credencial/certificado (fora do MVP)
```

Regra dura: **a venda nunca depende da disponibilidade da SEFAZ para existir**. A
emissão é sempre assíncrona/desacoplada via `FiscalOperation`.

## 2. FiscalOperation (entidade operacional)

```
id, tenantId, storeId, saleId,
operationType,       // NFCe | NFe
originalDocumentKey?, nfeKey?,           // identificadores do documento
providerId,          // qual provider deve processar
status,              // ver §4
authorizationCode?, protocol?,           // resposta da autorização
danfe?, xmlUrl?, xmlPayload?,            // documentos gerados
attempts, lastError, lastEventAt,
clientOperationId,   // idempotência
createdAt, updatedAt
```

`FiscalDocument`/`FiscalEvent` (futuro) armazenam XML, DANFE, eventos e o histórico por
documento. Estados sempre rastreáveis.

## 3. Interface FiscalProvider (obrigatória desde o MVP)

```ts
interface FiscalProvider {
  issueNfce(doc: FiscalOut): Promise<FiscalResult>
  issueNfe(doc: FiscalOut): Promise<FiscalResult>
  cancel(op: FiscalOperation): Promise<FiscalResult>
  queryStatus(op): Promise<FiscalStatus>
  getDocument(op): Promise<FiscalDocument>
  getFiscalStatus(state: string): Promise<ServiceAvailability>
}
```

`NoopFiscalProvider` (MVP): registra a intenção, **nunca** produz autorização,
protocolo, DANFE ou XML falsos. Funcionalidades que exijam SEFAZ/certificado permanecem
**❌ BLOQUEADAS** no checklist.

## 4. Estados de FiscalOperation

```
PENDING → PROCESSING → AUTHORIZED
                    → REJECTED  (motivo registrado, pode reprocessar)
                    → CONTINGENCY (emitido em contingência offline / arquitetura)
                    → CANCELLED
                    → ERROR
```

- `REJECTED`/`ERROR` nunca apagam a venda. `reprocess()` permite reenviar após correção.
- Contingência é fluxo de primeira classe (offline fiscal), não finta.

## 5. Fluxo do PDV

```
Venda finalizada (online/offline)
 → Sale.fiscalStatus = PENDING
 → cria FiscalOperation(PENDING) (mesma transação da venda)
 → fila: processamento assíncrono (quando online e provider habilitado)
 → resultado atualiza sale.fiscalStatus:
     AUTHORIZED  | REJECTED  | CONTINGENCY  | CANCELLED
```

## 6. Sem simulação

- **Proibido** marcar `AUTHORIZED`/emitir protocolo sem resposta real do provedor.
- `NoopFiscalProvider` devolve apenas intenção/enfileiramento (estado `PENDING`),
  permitindo desenvolvimento do domínio com a venda funcionando normalmente.

## 7. Próximos passos (bloqueados até credenciais/homologação)

NFC-e, NF-e, XML, DANFE/DANFE NFC-e, cancelamento, consulta de status, eventos e
reprocessamento via provedor real. Implementamos a arquitetura; a operação real fica
❌ BLOQUEADO (ver `CHECKLIST.md` F14-03/04/05/07).