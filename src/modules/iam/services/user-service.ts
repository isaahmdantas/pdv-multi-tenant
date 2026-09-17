import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { CreateUserInput } from "@/modules/iam/schemas";
import { UserRepository } from "@/modules/iam/repositories/user-repository";
import { PasswordService } from "@/modules/iam/password";
import { AuditService } from "@/modules/audit/services/audit-service";
import { conflict, badRequest } from "@/lib/api/errors";

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    ctx: TenantContext,
    input: CreateUserInput,
    meta?: { ip?: string; device?: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const userRepo = new UserRepository(this.prisma, ctx);

    if (await userRepo.existsByEmail(email)) {
      throw conflict("E-mail já cadastrado neste tenant", "EMAIL_TAKEN");
    }

    const [roleCount, storeCount] = await Promise.all([
      this.prisma.role.count({
        where: { tenantId: ctx.tenantId, id: { in: input.roleIds } },
      }),
      input.stores.length
        ? this.prisma.store.count({
            where: {
              tenantId: ctx.tenantId,
              id: { in: input.stores.map((s) => s.storeId) },
            },
          })
        : 0,
    ]);

    if (roleCount !== input.roleIds.length) {
      throw badRequest("Uma ou mais roles não pertencem a este tenant", "INVALID_ROLES");
    }
    if (input.stores.length && storeCount !== input.stores.length) {
      throw badRequest("Uma ou mais unidades não pertencem a este tenant", "INVALID_STORES");
    }

    const passwordHash = await PasswordService.hash(input.password);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          email,
          passwordHash,
          roles: {
            create: input.roleIds.map((roleId) => ({
              tenantId: ctx.tenantId,
              roleId,
            })),
          },
          userStores: {
            create: input.stores.map((s) => ({
              tenantId: ctx.tenantId,
              storeId: s.storeId,
              storeRoleId: s.storeRoleId ?? null,
            })),
          },
        },
        select: { id: true, tenantId: true, name: true, email: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "USER_CREATED",
        entity: "User",
        entityId: user.id,
        after: user,
        ip: meta?.ip,
        device: meta?.device,
      });

      return user;
    });

    return created;
  }
}