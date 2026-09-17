# PAYMENTS — Abstração de Pagamentos

## 1. Princípio

O domínio de venda não conhece gateway, adquirente, TEF ou pinpad. Toda captura passa
pela porta `PaymentProvider`. No MVP os meios funcionam **internamente** (crédito
simulado **local**, sem transação bancária real), nunca fingindo autorização externa.

## 2. Entidades

```
PaymentMethod  — tenantId; configuração: name, code, type (CASH|PIX|CREDIT|DEBIT|VOUCHER|WALLET|OTHER),
                 needsExternalProvider, active
Payment        — tenantId, saleId, paymentMethodId, amount(Decimal),
                 capturedAmount?, change(Decimal), status,
                 externalRef?, providerId?, clientOperationId, createdAt
```

Múltiplos pagamentos: soma de `Payment.amount` = total da venda (regra no `SaleService`).

## 3. Interface PaymentProvider (porta)

```ts
interface PaymentProvider {
  capture(req: CaptureRequest): Promise<CaptureResult>   // dinheiro, PIX, cartão, etc.
  refund(req: RefundRequest): Promise<RefundResult>
  query(req: QueryRequest): Promise<PaymentStatus>
  supports(method: PaymentMethod): boolean
}
```

`CaptureRequest { tenantId, storeId, terminalId, methodCode, amount, clientOperationId }`.
Resultado contém `status` (APPROVED | REJECTED | PENDING | ERROR) e `externalRef`
quando houver.

**Providers MVP** (internos, `modules/payments/providers/`):
- `CashPaymentProvider` — aprova imediato; calcula troco. (não externo)
- `LocalCardPaymentProvider`/`LocalPixProvider` — simulação **local** com ID próprio,
  marcada como `internal: true`; texto da tela deixa claro que não é transação bancária
  real (evitar engano — exigência do ajuste nº5).

**Providers reais (futuro, ❌ BLOQUEADO até contratação):** PIX dinâmico/estático,
TEF, adquirentes, pinpad — implementam a mesma interface sem tocar no domínio.

## 4. Fluxo no PDV

```
Carrinho → PaymentService.process(sale, payments[])
  para cada forma: provider = registry.get(method.providerKey)
    → capture()
    → Payment registrado (própria transação da venda)
  troco = sum(amount) - total  (apenas CASH gera troco)
```

- Pagamento reprovado/erro → venda permanece aberta; nenhum Payment parcial fica órfão
  (transação). Estorno → leva `Payment.status = REFUNDED` + motorauditoria.
- `clientOperationId` por payment garante idempotência em retries offline.

## 5. Registry

`PaymentProviderRegistry` resolve por `method.providerKey`. O domínio chama a porta;
a injeção de providers reais no futuro é config-only.

## 6. Histórico (F12-08)

Lista de `Payment` por venda/periodo/unidade com status e troco — alimenta relatório de
pagamentos e fechamento de caixa (vendas por forma).

## 7. Sem simulação indevida

Providers internos registram `internal: true` e nunca emitem comprovante bancário ou
código de autorização falso. O checklist marca integrações externas como ❌ BLOQUEADO
(até contratação/homologação).