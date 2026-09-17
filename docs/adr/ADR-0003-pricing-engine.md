# ADR-0003 — Motor de Preços

**Status:** ACEITO · **Data:** 2026-09-16

## Contexto

Preço depende de tenant + unidade + categoria de cliente + produto + quantidade +
período + promoção. Regras espalhadas por arquivos gerariam comportamento imprevisível
e venda com preço errado.

## Decisão

1. **`PricingService` é a única porta** de resolução de preço no domínio; PDV nunca
   implementa seleção de preço.
2. **Prioridade em constante única** (`PRICE_PRIORITY`) documentada no `PRICING.md §3`:
   promoção → produto+unidade+categoria → unidade+categoria → unidade → categoria →
   preço padrão do produto. Empates: maior `priority` da tabela → vigência → `createdAt`.
3. **Preço gravado na venda** (`SaleItem.unitPrice`) — o histórico não é reconstruído
   por tabela atual.
4. Categoria anônima resolvida por `CustomerCategory.isDefault` (com fallback da unidade).
5. Desconto aplicado **após** a resolução, com permissão `sales.discount` e auditoria.

## Consequências

- Engine pura → testável (suíte F7-11 com 9 casos obrigatórios).
- Custo pequeno de models (`PriceTable`, `ProductPrice`, `Promotion`) mapeados desde o
  início evitando retrabalho.

## Alternativas

- Regras no banco (stored procs): rejeitada (portabilidade e testabilidade).
- Estratégia espalhada nos módulos: rejeitada (o problema que este ADR resolve).