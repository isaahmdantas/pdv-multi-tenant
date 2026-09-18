import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export class CustomerCategoryRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(includeInactive = false) {
    return this.prisma.customerCategory.findMany({
      where: {
        ...this.scope({}),
        status: includeInactive ? undefined : "ACTIVE",
      },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.customerCategory.findFirst({
      where: { ...this.scope({ id }) },
    });
  }

  findByName(name: string) {
    return this.prisma.customerCategory.findFirst({
      where: { ...this.scope({ name }) },
      select: { id: true, name: true },
    });
  }
}