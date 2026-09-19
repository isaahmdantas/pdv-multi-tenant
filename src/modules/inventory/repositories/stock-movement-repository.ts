import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { StockMovementType } from "@/modules/inventory/constants";

export const stockMovementInclude = {
  product: { select: { id: true, name: true, sku: true } },
  unitOfMeasure: { select: { id: true, code: true, name: true } },
} as const;

export class StockMovementRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(
    storeId: string,
    opts: { productId?: string; type?: StockMovementType; limit?: number } = {},
  ) {
    const { productId, type, limit = 100 } = opts;
    return this.prisma.stockMovement.findMany({
      where: {
        ...this.scope({}),
        storeId,
        ...(productId ? { productId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: stockMovementInclude,
    });
  }
}

export function stockMovementRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new StockMovementRepository(prisma, ctx);
}