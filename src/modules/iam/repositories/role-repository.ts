import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";

export class RoleRepository extends TenantScopedRepository {
  async list() {
    return this.prisma.role.findMany({
      where: this.scope({}),
      orderBy: { name: "asc" },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async findByName(name: string) {
    return this.prisma.role.findFirst({
      where: this.scope({ name }),
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.role.findFirst({
      where: this.scope({ id }),
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }
}

export function roleRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new RoleRepository(prisma, ctx);
}