# ADR-0006 — Reserva de Estoque (preparação, sem fluxo na F8)

**Status:** ACEITO · **Data:** 2026-09-19

## Contexto

Durante o PDV (Fase 11), um item do carrinho compromete estoque antes de a venda ser
finalizada; múltiplos PDVs de unidades diferentes podem vender o mesmo item em paralelo.
Introduzir reserva sem o fluxo de venda criaria regras incompletas e conceitos errados
cedo demais.

## Decisão

1. **Preparar o modelo na F8, não implementar o fluxo.** `StockBalance` ganha
   `quantity`, `reservedQuantity` e `availableQuantity` (= quantity − reservedQuantity),
   com o estoque por unidade na entidade central.
2. **Reserva ≠ movimentação física.** Reserva é comprometimento temporário de estoque
   (venda em aberto/suspensa) e **não** gera `StockMovement` nem altera `quantity`.
   `StockMovement` só registra variação física do saldo (IN/OUT/ADJUST/TRANSFER).
3. O fluxo de reserva (reserver/release/expirar) será implementado na F11 junto do PDV,
   usando os campos e o `version` já presentes. Até lá, `reservedQuantity` permanece 0 e
   `availableQuantity` = `quantity`.
4. A regra de prioridade/alerta (LOW/HIGH) usa `availableQuantity`, já preparada.
5. Sem reserva, a proteção contra venda simultânea continua sendo a guarda atômica
   não-negativa do ADR-0005 (a venda baixa estoque na própria transação — última etapa
   crítica).

## Consequências

- Cinco fases à frente não precisarão alterar o schema de estoque para reservar.
- Risco residual: algum fluxo futuro exigir política de reserva por categoria/produto —
  será avaliado na Fase 11 como regra de negócio nova (sem mudança estrutural).
- Testes da F8 asseguram `reservedQuantity = 0` e `available = quantity` em todos os
  cenários de movimentação.

## Alternativas

- Implementar reserva completa agora: rejeitado — sem fluxo de venda não há quando
  reservar/liberar/expirar; criaria código morto e regras não testáveis.
- Calcular `availableQuantity` apenas para exibição: aceito parcialmente — o campo é
  mantido em banco (consultável/filtrável) mas sempre derivado de `quantity −
  reservedQuantity` pelos repositories.