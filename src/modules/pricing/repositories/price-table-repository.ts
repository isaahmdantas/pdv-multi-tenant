import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export const priceTableInclude = {
  store: { select: { id: true, name: true } },
  customerCategory: { select: { id: true, name: true, isDefault: true } },
} as const;

export class PriceTableRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(includeInactive = false) {
    return this.prisma.priceTable.findMany({
      where: {
        ...this.scope({}),
        active: includeInactive ? undefined : true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: priceTableInclude,
    });
  }

  findById(id: string) {
    return this.prisma.priceTable.findFirst({
      where: { ...this.scope({ id }) },
      include: priceTableInclude,
    });
  }

  findByName(name: string) {
    return this.prisma.priceTable.findFirst({
      where: { ...this.scope({ name }) },
      select: { id: true, name: true },
    });
  }
}

export function priceTableRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new PriceTableRepository(prisma, ctx);
}