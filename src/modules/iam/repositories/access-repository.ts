import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";

export class AccessRepository extends TenantScopedRepository {
  async findStore(storeId: string) {
    return this.prisma.store.findFirst({
      where: this.scope({ id: storeId, status: "ACTIVE" }),
    });
  }

  async findUserStore(storeId: string) {
    return this.prisma.userStore.findFirst({
      where: this.scope({ userId: this.ctx.userId, storeId }),
      include: { store: true, storeRole: true },
    });
  }

  async userGlobalRoles() {
    return this.prisma.role.findMany({
      where: this.scope({
        userRoles: { some: { userId: this.ctx.userId } },
      }),
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async storeRolePermissions(storeRoleId: string) {
    return this.prisma.role.findFirst({
      where: this.scope({ id: storeRoleId }),
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async userStores() {
    return this.prisma.userStore.findMany({
      where: this.scope({ userId: this.ctx.userId }),
      include: { store: true },
    });
  }

  async userHasGlobalStoreAccess() {
    const globalRoles = await this.userGlobalRoles();
    return globalRoles.some((r) => r.globalStoreAccess);
  }
}

export function accessRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new AccessRepository(prisma, ctx);
}