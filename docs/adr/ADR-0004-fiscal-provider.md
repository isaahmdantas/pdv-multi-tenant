# ADR-0004 — Fiscal Provider

**Status:** ACEITO · **Data:** 2026-09-16

## Contexto

Emissão fiscal (NFC-e/NF-e) depende de SEFAZ, certificado digital e credenciais. A
venda nunca deve depender da disponibilidade da SEFAZ para existir. É preciso permitir
troca de provedor sem alterar o domínio.

## Decisão

1. **Separação em camadas**: `Venda comercial → FiscalOperation → FiscalProvider → SEFAZ`.
2. A venda cria `FiscalOperation` (mesma transação) e segue com `sale.fiscalStatus =
   PENDING`; a emissão é **assíncrona** e **desacoplada**.
3. **`FiscalProvider`** é a porta trocável (`issueNfce`, `issueNfe`, `cancel`,
   `queryStatus`, `getDocument`).
4. MVP: **`NoopFiscalProvider`** — registra intenção e enfileira; **nunca simula**
   autorização, protocolo, XML, DANFE ou DANFE NFC-e.
5. Estados: `PENDING → PROCESSING → AUTHORIZED | REJECTED | CONTINGENCY | CANCELLED |
   ERROR`; rejeição/erro nunca apagam a venda; `reprocess()` permite reenvio.
6. Funcionalidades que exigem certificado/credenciais/SEFAZ → **❌ BLOQUEADO** no
   checklist (F14-03/04/05/07), nunca "simuladas como reais".

## Consequências

- Integração futura = novo provider de homologação configurado por tenant, sem tocar no
  domínio.
- Histórico fiscal (`FiscalDocument`, `FiscalEvent`) é persistido por operação.

## Alternativas

- Emitir NFC-e inline no fluxo da venda: rejeitada (acopla venda à SEFAZ).
- Simular autorização no MVP: rejeitada por violar o princípio "nunca simular como real".