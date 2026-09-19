import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export const purchaseInclude = {
  store: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true, document: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, baseUnitId: true } },
      unitOfMeasure: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

export class PurchaseRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(storeId?: string, status?: string) {
    return this.prisma.purchase.findMany({
      where: {
        ...this.scope({}),
        ...(storeId ? { storeId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: purchaseInclude,
    });
  }

  findById(id: string, storeScope = false) {
    return this.prisma.purchase.findFirst({
      where: storeScope ? this.scopeStore({ id }) : this.scope({ id }),
      include: purchaseInclude,
    });
  }
}

export function purchaseRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new PurchaseRepository(prisma, ctx);
}