import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { CreateRoleInput } from "@/modules/iam/schemas";
import { RoleRepository } from "@/modules/iam/repositories/role-repository";
import { isValidPermissionCode } from "@/modules/iam/schema-validation";
import { AuditService } from "@/modules/audit/services/audit-service";
import { conflict, badRequest } from "@/lib/api/errors";

export class RoleService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext) {
    const repo = new RoleRepository(this.prisma, ctx);
    const roles = await repo.list();
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      globalStoreAccess: r.globalStoreAccess,
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
    }));
  }

  async create(
    ctx: TenantContext,
    input: CreateRoleInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new RoleRepository(this.prisma, ctx);
    const name = input.name.trim().toUpperCase();

    if (await repo.findByName(name)) {
      throw conflict("Já existe uma role com este nome", "ROLE_TAKEN");
    }

    const invalid = input.permissionCodes.filter((c) => !isValidPermissionCode(c));
    if (invalid.length > 0) {
      throw badRequest("Permissões inválidas", "INVALID_PERMISSIONS");
    }

    // Garante que as permissões existam neste tenant (criadas no seed).
    const permissionRows = await this.prisma.permission.findMany({
      where: { tenantId: ctx.tenantId, code: { in: input.permissionCodes } },
    });
    if (permissionRows.length !== input.permissionCodes.length) {
      throw badRequest("Permissões não cadastradas no tenant", "PERMISSIONS_NOT_FOUND");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId: ctx.tenantId,
          name,
          description: input.description ?? null,
          globalStoreAccess: input.globalStoreAccess ?? false,
          rolePermissions: {
            create: permissionRows.map((p) => ({
              tenantId: ctx.tenantId,
              permissionId: p.id,
            })),
          },
        },
        select: { id: true, tenantId: true, name: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "ROLE_CREATED",
        entity: "Role",
        entityId: role.id,
        after: { name: role.name, globalStoreAccess: input.globalStoreAccess },
        ip: meta?.ip,
        device: meta?.device,
      });

      return role;
    });

    return created;
  }
}