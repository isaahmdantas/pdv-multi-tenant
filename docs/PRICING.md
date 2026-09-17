# PRICING — Motor de Preços

> ADR: `docs/adr/ADR-0003`. Prioridade única, centralizada e testada.

## 1. Entidades

**PriceTable** — grupo de preços com escopo e vigência:

```
id, tenantId, name, description,
storeId?          (null = vale para o tenant inteiro)
customerCategoryId?  (null = vale para qualquer categoria)
priority, validFrom, validUntil?, active
```

**ProductPrice** — preço de um produto numa tabela:

```
id, tenantId, priceTableId, productId,
unitPrice (Decimal),
minimumQuantity?, maximumQuantity?   // preço por faixa de quantidade
```

**Promotion** — preço/desconto temporário:

```
id, tenantId, storeId?, productId?, customerCategoryId?,
discountType (PERCENTAGE | FIXED), discountValue,
validFrom, validUntil, active
```

## 2. PricingService

Entrada (pura, tipada):

```ts
PricingRequest {
  tenantId, storeId,
  productId,
  customerId?, customerCategoryId?,   // null → categoria padrão p/ venda anônima
  quantity?, dateTime?
}
```

Saída:

```ts
PricingResult {
  unitPrice: Decimal
  priceTableId?: string
  promotionId?: string
  appliedRule: PriceRule   // qual degrau da prioridade venceu
  displayPrice: Decimal    // preço a mostrar (após promoção)
}
```

Assinatura: `PricingService.resolve(req): Promise<PricingResult>`.
O PDV **nunca** implementa seleção de preço — apenas consome `PricingService`.

## 3. Prioridade (constante única — não espalhar)

`PRICE_PRIORITY` em `modules/pricing/constants.ts` (única fonte da ordem):

| # | Regra | Detalhe |
|---|---|---|
| 1 | **Promoção ativa** | promoção vigente mais específica (produto+unidade > produto) |
| 2 | **Tabela produto + unidade + categoria** | tabelas com storeId e customerCategoryId (qty na faixa) |
| 3 | **Tabela unidade + categoria** | storeId e customerCategoryId, sem productPrice específico → usa preço padrão da tabela |
| 4 | **Tabela somente unidade** | storeId, categoria null |
| 5 | **Tabela somente categoria** | storeId null, categoria = categoria padrão/cliente |
| 6 | **Preço padrão do produto** | `product.basePrice` (fallback absoluto) |

Empates na mesma regra: vence a de **maior prioridade numérica da tabela**; depois a de
**vigência ativa mais recente**; depois `createdAt` mais recente. Quantidade: entre
`minimumQuantity` e `maximumQuantity` (inclusivos); sem faixa = aplica-se à quantidade.

Anônimo: `customerCategoryId` ausente → usa `CustomerCategory.isDefault` mais o padrão
da unidade (`Store.defaultCustomerCategoryId` se existir) — resolução documentada aqui.

## 4. Vendas não dependem da tabela atual

`SaleItem` grava `unitPrice` + `discount` + `total` + `priceTableId` + `promotionId`
usados efetivamente no momento da venda. Relatórios históricos usam os campos gravados,
nunca re-resolvem preço.

## 5. Descontos no PDV

- Desconto item e total são aplicados **após** o preço resolvido pelo PricingService.
- Liberação de desconto controlada por permissão `sales.discount` (e limites por role
  se configurados). Desconto registrado com motivo em auditoria.

## 6. Testes obrigatórios (F7-11)

1. Prioridade 1 vence promoção ativa sobre tabela.
2. Prioridade 2 × 3: produto+unidade+categoria vence unidade+categoria.
3. Unidade-categoria sobre somente unidade/categoria.
4. Categoria anônima (default) quando cliente ausente.
5. Faixa de quantidade (1–9 / 10–49 / 50+).
6. Tabela expirada/futura ignorada; inativa ignorada.
7. Empate → maior priority, depois vigência, depois createdAt.
8. Comportamento sem nenhuma tabela → `basePrice`.
9. `unitPrice` gravado na venda congela o preço (90 dias depois, preço muda — venda
   antiga preserva valor).