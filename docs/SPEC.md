# SPEC — Sistema PDV Multi-Tenant

> Fonte persistente das decisões de escopo e arquitetura. Revisões nesta spec exigem
> atualização dos ADRs correspondentes.

## 1. Produto

Plataforma comercial completa de Ponto de Venda (PDV), multi-tenant, offline-first,
preparada para emissão fiscal, self-checkout e evolução para SaaS.

- **Stack:** Next.js (App Router), TypeScript, React, Tailwind CSS, shadcn/ui, PWA,
  Service Worker, IndexedDB, Prisma, PostgreSQL. Autenticação: Auth.js (NextAuth v5).
- **Banco inicial:** PostgreSQL. **Migração futura:** Microsoft SQL Server (portabilidade
  adotada desde o modelo de dados — ver `adr/ADR-0005`).

## 2. Princípios

1. Multi-tenant desde a primeira linha de arquitetura. Dados de um tenant nunca vazam
   para outro (ver `adr/ADR-0001`, `docs/MULTI_TENANT.md`).
2. `tenantId` e `storeId` **sempre** derivados da sessão/contexto autenticado e da
   autorização — nunca confiáveis enviados pelo frontend.
3. `storeId` (unidade atual) é uma **seleção de contexto mutável**, não uma verdade
   permanente do usuário.
4. Dinheiro é sempre `Decimal` (Prisma). Nunca `float`.
5. Vendas gravam o preço efetivo no item; tabelas de preço nunca reconstroem vendas antigas.
6. Vendas devem existir independentemente da disponibilidade de SEFAZ, gateway de
   pagamento ou conectividade (`offline-first`).
7. Portabilidade de banco: sem tipos/extensões PostgreSQL, sem enums nativos, sem RLS
   como mecanismo primário de isolamento, sem SQL específico (ver `adr/ADR-0005`).
8. Concorrência protegida no `StockService`/`StockRepository` com *optimistic
   concurrency* e operações atômicas — nunca acoplada a `SELECT ... FOR UPDATE`.

## 3. Escopo do MVP (fatia vertical)

Fluxo completo de venda com validações por fase (numeradas conforme o Prompt Mestre):

1. **Fase 0** — análise, ADRs, documentação, roadmap, checklist. *(Em andamento)*
2. **Fase 1** — fundação (scaffold, lint, testes, Prisma, db `pdv`).
3. **Fase 2** — multi-tenant (Tenant, Store, TenantContext, repositórios, isolamento).
4. **Fase 3** — autenticação e autorização (usuários, roles, permissões, sessão).
5. **Fase 4** — unidades (configuração, usuários por unidade, caixas, terminais).
6. **Fase 5** — produtos (categorias, marcas, produtos, barras, UoM, conversões, ProductStore).
7. **Fase 6** — clientes (categorias, cadastro).
8. **Fase 7** — preços (PriceTable, ProductPrice, promoções, PricingService).
9. **Fase 8** — estoque (balance, movimentações, ajustes, min/máx).
10. **Fase 10** — caixa (abertura, suprimento, sangria, fechamento, conferência).
11. **Fase 11 + 12** — PDV e pagamentos (carrinho, busca, barras, pagamentos múltiplos, troco).
12. **Fase 13** — offline-first (PWA, IndexedDB, SyncQueue, idempotência, indicador).
13. **Fase 9** — compras/fornecedores.
14. **Fase 15** — autoatendimento (self-checkout).
15. **Fase 14** — fiscal (FiscalService + operação fiscal; provider real marcado BLOQUEADO).
16. **Fases 16–21** — relatórios, dashboard/inteligência, segurança, testes, performance, documentação.

> Sempre que fases forem agrupadas, o agrupamento é **explícito** em `docs/ROADMAP.md`.
> A numeração das fases nunca é renumerada nem eliminada.

## 4. Fora do escopo do MVP (bloqueado ou futuro)

| Funcionalidade | Status | Motivo |
|---|---|---|
| Emissão NFC-e/NF-e real (SEFAZ) | ❌ BLOQUEADO | Exige certificado digital/credenciais. Abstração pronta, nunca simulada como real |
| Integração gateway/adquirente/PIX real | ❌ BLOQUEADO | Exige contratação. Abstração `PaymentProvider` pronta |
| Impressora térmica homologada | ❌ BLOQUEADO | Exige equipamento |
| Push notifications (WhatsApp) | ⬜ NÃO INICIADO | Fase posterior |

## 5. Abstrações obrigatórias

- `FiscalProvider` — API de emissão/cancelamento/consulta; `NoopFiscalProvider` no MVP,
  sem simular autorização real.
- `PaymentProvider` — API de captura/estorno/consulta de pagamento; providers internos
  (simulação de dinheiro/PIX/cartão) no MVP, sem simular transação externa real.
- `PricingService` — motor de preços com prioridade única e documentada.
- `PrintService` — geração de comprovantes/DANFE.
- `SyncService` — fila de sincronização com idempotência.

## 6. Critérios de conclusão

Uma funcionalidade recebe `✅ CONCLUÍDO` somente quando validada de ponta a ponta:

> UI + API + regra de negócio + banco + validação + segurança + multi-tenant +
> auditoria + testes + offline + sincronização (quando aplicável).

Tela, botão, API ou tabela existentes **não** constituem conclusão.

## 7. Visão geral dos fluxos

```
Login → TenantContext(tenantId) → unidade atual (storeId)
  → PDV: produto → preço (PricingService) → carrinho → pagamento (PaymentProvider)
  → venda transacional → estoque (StockService) → caixa → auditoria → fiscal (operação)
  → offline: fila local → SyncService (clientOperationId)
```

## 8. Referências

- `docs/ROADMAP.md` — fases preservadas do Prompt Mestre.
- `docs/CHECKLIST.md` — fonte oficial de progresso.
- `docs/ARCHITECTURE.md` — visão estrutural e de camadas.
- `docs/DATABASE.md` — entidades e classificação de escopo.
- `docs/MULTI_TENANT.md` — estratégia de isolamento e contexto.
- `docs/PRICING.md`, `OFFLINE_FIRST.md`, `SYNC.md`, `FISCAL.md`, `PAYMENTS.md`,
  `SECURITY.md`, `API.md`.
- `docs/adr/` — decisões arquiteturais.