-- Add clientOperationId (idempotência do checkout F11/F13) + unique tenant-escoped.
-- (coluna/índice já aplicados em execução parcial anterior; este delta é idempotente no registro)
ALTER TABLE "Sale" ADD COLUMN "clientOperationId" VARCHAR(64);
CREATE UNIQUE INDEX "Sale_tenantId_clientOperationId_key" ON "Sale"("tenantId", "clientOperationId");
