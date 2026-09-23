-- F11: congelamento de preço nos itens de venda (F7-11 do CHECKLIST).
-- Grava a tabela de preço e a promoção aplicadas no momento da venda,
-- para que preços históricos nunca sejam recalculados.
ALTER TABLE "SaleItem" ADD COLUMN "priceTableId" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN "promotionId" TEXT;