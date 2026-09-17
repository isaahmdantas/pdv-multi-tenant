import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";

export class StoreRepository extends TenantScopedRepository {
  async list(includeInactive = false) {
    return this.prisma.store.findMany({
      where: this.scope(includeInactive ? {} : { status: "ACTIVE" }),
      orderBy: { code: "asc" },
      include: { _count: { select: { userStores: true } } },
    });
  }

  async findById(id: string) {
    return this.prisma.store.findFirst({
      where: this.scope({ id }),
    });
  }

  async findByCode(code: string) {
    return this.prisma.store.findFirst({
      where: this.scope({ code }),
    });
  }
}

export function storeRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new StoreRepository(prisma, ctx);
}