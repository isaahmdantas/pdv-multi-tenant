-- F12-07: rastreamento de estorno total/parcial por venda e por item.
ALTER TABLE "Sale" ADD COLUMN "refundedTotal" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "SaleItem" ADD COLUMN "refundedQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0;
