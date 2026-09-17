# ROADMAP

> Numeração das fases **preservada integralmente** do Prompt Mestre. Nenhuma fase é
> renumerada ou eliminada. Fases agrupadas são declaradas explicitamente. Status atual
> sempre em `CHECKLIST.md` — este arquivo define a sequência e as dependências.

## Fases (ordem original do Prompt Mestre)

- **FASE 0** — Planejamento (análise, arquitetura, modelo, estratégias, ADRs)
- **FASE 1** — Fundação (Next.js, TS, Tailwind, shadcn, Prisma, PostgreSQL, env, lint, testes, arquitetura modular)
- **FASE 2** — Multi-tenant (Tenant, contexto, isolamento, middleware, repositories, autorização, testes, auditoria)
- **FASE 3** — Autenticação (usuários, login/logout, sessão, roles, permissões, proteção de rotas)
- **FASE 4** — Unidades da empresa (cadastro, configuração, usuários por unidade, estoque por unidade, caixas, terminais, fiscal por unidade)
- **FASE 5** — Produtos (categorias, marcas, produtos, SKU, barras, UoM, conversões, produtos por unidade, campos fiscais)
- **FASE 6** — Clientes (cadastro, categorias, histórico, limite, fidelidade)
- **FASE 7** — Preços (PriceTable, ProductPrice, preço padrão/por unidade/por categoria/quantidade, promoções, prioridade, PricingService, testes)
- **FASE 8** — Estoque (StockBalance, movimentações, entradas/saídas/ajustes, inventário, transferências, min/máx, alertas)
- **FASE 9** — Compras (fornecedores, pedido, entrada, custo, lote, validade, integração estoque)
- **FASE 10** — Caixa (cadastro, abertura, suprimento, sangria, movimentações, fechamento, conferência, diferença, relatório)
- **FASE 11** — PDV (tela, busca, barras, carrinho, quantidade, cliente, preço, desconto, cancelamento, suspensão, recuperação, pagamento, troco, finalização)
- **FASE 12** — Pagamentos (dinheiro, PIX, crédito, débito, voucher, múltiplos pagamentos, estorno, histórico)
- **FASE 13** — Offline-first (PWA, manifest, service worker, IndexedDB, cache, dados offline, SyncQueue, idempotência, retry, sincronização, conflitos, indicador, testes)
- **FASE 14** — Fiscal (FiscalService, provider, NFC-e, NF-e, XML, eventos, cancelamento, rejeições, contingência, reprocessamento, histórico)
- **FASE 15** — Autoatendimento (terminal, self-checkout, touchscreen, scanner, carrinho, pagamento, finalização, chamada funcionário, offline)
- **FASE 16** — Relatórios (vendas, produtos, estoque, caixa, pagamentos, clientes, fornecedores, fiscal, exportações)
- **FASE 17** — Dashboard/Inteligência (KPIs, alertas, parados, ruptura, sugestão compra, análises)
- **FASE 18** — Segurança (autenticação, autorização, multi-tenant, rate limiting, validação, auditoria, logs, offline)
- **FASE 19** — Testes (unit, integração, E2E, multi-tenant, preços, caixa, estoque, PDV, offline, sync, idempotência, concorrência)
- **FASE 20** — Performance (frontend, PDV, cache, banco, índices, queries, offline, sync)
- **FASE 21** — Documentação (README, ARCHITECTURE, DATABASE, MULTI_TENANT, PRICING, OFFLINE_FIRST, SYNC, FISCAL, SECURITY, API, DEPLOYMENT, ADRs)

## Sequência de execução do MVP (fatia vertical)

Agrupamentos explícitos (não renumeram fases):

| Grupo | Fases | Entrega validada (checkpoint) |
|---|---|---|
| G1 | 0 | Documentação, ADRs, roadmap, checklist, checkpoint |
| G2 | 1 | Fundação rodando: build + lint + testes + db `pdv` |
| G3 | 2 | Isolamento multi-tenant comprovado (testes A×B) |
| G4 | 3 | Login, sessão com tenant, roles/permissões, rotas protegidas |
| G5 | 4 | Unidades, usuários por unidade, seletor de unidade |
| G6 | 5 | Produtos completos com UoM/conversões e ProductStore |
| G7 | 6 | Clientes e categorias de cliente |
| G8 | 7 | PricingService completo + testes de prioridade |
| G9 | 8 | Estoque por unidade, movimentações, ajustes, concorrência |
| G10 | 10 | Abertura/fechamento/conferência de caixa |
| G11 | 11 + 12 | PDV funcional com pagamentos múltiplos e troco |
| G12 | 13 | Venda offline + sincronização com idempotência |
| G13 | 9 | Compras/fornecedores e entrada de estoque |
| G14 | 15 | Self-checkout |
| G15 | 14 | FiscalService + operação fiscal + NoopProvider (SEFAZ real ❌) |
| G16 | 16 + 17 | Relatórios e dashboard |
| G17 | 18 + 19 | Hardening de segurança e suíte de testes completa |
| G18 | 20 | Performance |
| G19 | 21 | Documentação final |

**Regra de progressão:** não avance múltiplas fases sem validar o checkpoint de cada
grupo. Se o contexto estiver próximo do limite: salvar → atualizar `CHECKLIST.md` →
validar → checkpoint → informar onde parou.

**Retomada:** ler `CHECKLIST.md`, `ROADMAP.md`, último checkpoint, código, migrations e
testes; continuar exatamente da primeira etapa pendente. Nunca reiniciar, nunca duplicar.