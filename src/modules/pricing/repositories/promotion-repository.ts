import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export const promotionInclude = {
  store: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, sku: true } },
  customerCategory: { select: { id: true, name: true, isDefault: true } },
} as const;

export class PromotionRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(includeInactive = false) {
    return this.prisma.promotion.findMany({
      where: {
        ...this.scope({}),
        active: includeInactive ? undefined : true,
      },
      orderBy: [{ createdAt: "desc" }],
      include: promotionInclude,
    });
  }

  findById(id: string) {
    return this.prisma.promotion.findFirst({
      where: { ...this.scope({ id }) },
      include: promotionInclude,
    });
  }
}

export function promotionRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new PromotionRepository(prisma, ctx);
}