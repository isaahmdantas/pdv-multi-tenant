# CASH — Caixa

Caixa cobre o ciclo diário de abertura e fechamento de **sessões de caixa** por unidade:
**abertura** (F10-02) → **suprimento** (F10-03) / **sangria** (F10-04) e **movimentações**
(F10-05) → **fechamento** (F10-06) com **conferência** (F10-07) e classificação de
**diferença** (F10-08) → **relatório** (F10-09). Deps: F2 (multi-tenant) e F4
(StoreScoped + cadastro de `CashRegister`).

## 1. Entidades

**CashSession** — sessão de caixa da unidade (`StoreScoped`), com status OPEN/CLOSED:

```
id, tenantId, storeId, cashRegisterId, openedBy,
status (OPEN | CLOSED),            // fluxo: OPEN → CLOSED (sem reabertura do mesmo id)
openingAmount (Decimal, padrão 0),
closingAmount (Decimal, preenchido no fechamento = esperado),
difference (Decimal, = contado − esperado),
classification (EXACT | SURPLUS | SHORTAGE, preenchido no fechamento),
openedAt, closedAt?, createdAt, updatedAt
```

**CashMovement** — movimentação da sessão (apenas `tenantId`, via `CashSession`):

```
id, tenantId, storeId, cashSessionId, createdBy,
type (OPENING | SALE | SUPPLY | WITHDRAW | CLOSING | ADJUSTMENT),
methodCode (CASH | PIX | CREDIT | DEBIT | VOUCHER, opcional — nulo no CLOSING),
amount (Decimal), notes?, referenceType?, referenceId?, createdAt
```

> **SALE/ADJUSTMENT:** reservados. `SALE` será gerado pelo PDV (F11-12) ao finalizar
> vendas; `ADJUSTMENT` fica para correções futuras. No MVP o cálculo do fechamento
> considera OPENING, SUPPLY e WITHDRAW.

## 2. Fluxo de status

```
        ┌─────────┐   abertura          ┌───────┐
        │  (n/a)  │ ──────────────────► │ OPEN  │ ──►  CLOSED
        └─────────┘                     └───────┘
```

- **OPEN** — sessão ativa na unidade; aceita suprimento, sangria e fechamento.
  Regra de negócio: **no máximo 1 sessão OPEN por caixa** (409 `CASH_SESSION_ALREADY_OPEN`).
- **CLOSED** — fechada: status, `closingAmount` (esperado), `difference` e
  `classification` gravados; movimentos adicionais rejeitados (400 `CASH_SESSION_NOT_OPEN`).
  Um novo ciclo inicia com uma **nova** sessão no mesmo caixa.

## 3. Regras e cálculo

**Abertura (`open`):**
- O caixa informado deve existir, estar `ACTIVE` e pertencer à **unidade atual**
  (400 `INVALID_CASH_REGISTER` — considera `ctx.storeId` + scoping).
- Com valor inicial > 0, gera movimento `OPENING`; com valor 0 não gera movimento.
- Auditoria: `CASH_OPENED`.

**Suprimento (`supply`) / Sangria (`withdraw`):**
- Exigem sessão `OPEN` da unidade atual; geram movimento `SUPPLY`/`WITHDRAW`
  com `methodCode` obrigatório (400 `CASH_SESSION_NOT_OPEN`; validação do método no schema).
- Auditoria: `CASH_SUPPLY` / `CASH_WITHDRAWAL`.

**Fechamento (`close`) — conferência:**
- Entrada: `countedByMethod` (mapa `methodCode → valor contado`); aceito com
  **≥ 1 método** (schema `refine`).
- Totais:
  - `sales = Σ movimentos SALE` (reservado a F11)
  - `supplies = Σ (OPENING + SUPPLY)`
  - `withdraws = Σ WITHDRAW`
  - `expected = sales + supplies − withdraws` (equivale a `closingAmount`)
  - `totalCounted = Σ countedByMethod`
  - `difference = totalCounted − expected`
  - `classification`: `EXACT` (diff = 0) | `SURPLUS` (diff > 0) | `SHORTAGE` (diff < 0)
- Grava sessão `CLOSED` + movimento `CLOSING` com `amount = difference` (methodCode nulo).
- Auditoria: `CASH_CLOSED`.

## 4. API

| Rota | Método | Permissão | Descrição |
|---|---|---|---|
| `/api/v1/cash-sessions` | GET | `reports.view` | Lista sessões (filtros: `storeId`, `status`, `cashRegisterId`, `fromDate`, `toDate`) |
| `/api/v1/cash-sessions` | POST | `cash.open` | Abre sessão `{ cashRegisterId, openingAmount?, notes? }` |
| `/api/v1/cash-sessions/[id]` | GET | `reports.view` | Sessão por id (com caixa, loja e movimentações) |
| `/api/v1/cash-sessions/[id]/supply` | POST | `cash.supply` | Suprimento `{ amount, methodCode, notes? }` |
| `/api/v1/cash-sessions/[id]/withdraw` | POST | `cash.withdraw` | Sangria `{ amount, methodCode, notes? }` |
| `/api/v1/cash-sessions/[id]/close` | POST | `cash.close` | Fechamento `{ countedByMethod }` |

## 5. UI

`/caixa` (server component, `dynamic='force-dynamic'`): formulário de abertura com
seletor de caixa; tabela de sessões com badge OPEN/CLOSED; ações de suprimento/sangria
(botão por método) para sessões abertas; formulário de fechamento com conferência
por método (esperado × contado) e síntese de total/diferença; lista de movimentações
por sessão aberta; cards de resumo (abertas, fechadas hoje, total de sessões).

## 6. Endpoints/tests

- Unit: `src/test/unit/cash-schemas.test.ts` (schemas + audit actions).
- Integração: `src/test/integration/cash.test.ts` (setup A×B, isolamento, fluxo completo:
  abertura, duas aberturas (409), suprimento/sangria, fechamento EXACT/SURPLUS/SHORTAGE,
  rejeições em sessão fechada, 404 cross-tenant, reabertura de caixa, listagem, auditoria).