import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";

export class TenantRepository extends TenantScopedRepository {
  async findById(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  async isStoreOfTenant(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: this.scope({ id: storeId }),
      select: { id: true },
    });
    return !!store;
  }
}

export function tenantRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new TenantRepository(prisma, ctx);
}