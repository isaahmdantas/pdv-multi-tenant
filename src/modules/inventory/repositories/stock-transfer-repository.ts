import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export const stockTransferInclude = {
  store: { select: { id: true, name: true, code: true } },
  destinationStore: { select: { id: true, name: true, code: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      unitOfMeasure: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export class StockTransferRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list() {
    return this.prisma.stockTransfer.findMany({
      where: { ...this.scope({}) },
      orderBy: { createdAt: "desc" },
      include: stockTransferInclude,
    });
  }

  findById(id: string) {
    return this.prisma.stockTransfer.findFirst({
      where: { ...this.scope({ id }) },
      include: stockTransferInclude,
    });
  }
}

export function stockTransferRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new StockTransferRepository(prisma, ctx);
}