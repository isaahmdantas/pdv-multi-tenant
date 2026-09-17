import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";

export class UserRepository extends TenantScopedRepository {
  async findById(id: string) {
    return this.prisma.user.findFirst({
      where: this.scope({ id, status: "ACTIVE" }),
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        status: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: this.scope({ email, status: "ACTIVE" }),
    });
  }

  async existsByEmail(email: string) {
    return !!(await this.findByEmail(email));
  }
}

export function userRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new UserRepository(prisma, ctx);
}