import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export const inventoryInclude = {
  store: { select: { id: true, name: true, code: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  },
} as const;

export class InventoryRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(storeId: string, includeClosed = false) {
    return this.prisma.inventory.findMany({
      where: { ...this.scope({}), storeId, status: includeClosed ? undefined : "OPEN" },
      orderBy: { startedAt: "desc" },
      include: inventoryInclude,
    });
  }

  findActive(storeId: string) {
    return this.prisma.inventory.findFirst({
      where: { ...this.scope({}), storeId, status: "OPEN" },
      include: inventoryInclude,
    });
  }

  findById(id: string) {
    return this.prisma.inventory.findFirst({
      where: { ...this.scope({ id }) },
      include: inventoryInclude,
    });
  }
}

export function inventoryRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new InventoryRepository(prisma, ctx);
}