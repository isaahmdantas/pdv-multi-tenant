import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { GrantUserStoreInput, UpdateUserStoreInput } from "@/modules/iam/schemas";
import { UserRepository } from "@/modules/iam/repositories/user-repository";
import { StoreRepository } from "@/modules/stores/repositories/store-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { notFound, badRequest, conflict } from "@/lib/api/errors";

export class UserStoreService {
  constructor(private readonly prisma: PrismaClient) {}

  async listForUser(ctx: TenantContext, userId: string) {
    const user = await this.assertUser(ctx, userId);
    const userStores = await this.prisma.userStore.findMany({
      where: { tenantId: ctx.tenantId, userId },
      include: {
        store: { select: { id: true, name: true, code: true, status: true } },
        storeRole: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      stores: userStores.map((us) => ({
        storeId: us.store.id,
        name: us.store.name,
        code: us.store.code,
        storeRole: us.storeRoleId ? { id: us.storeRole!.id, name: us.storeRole!.name } : null,
      })),
    };
  }

  async grant(
    ctx: TenantContext,
    userId: string,
    input: GrantUserStoreInput,
    meta?: { ip?: string; device?: string },
  ) {
    await this.assertUser(ctx, userId);
    await this.assertStore(ctx, input.storeId);
    if (input.storeRoleId) await this.assertRole(ctx, input.storeRoleId);

    const existing = await this.prisma.userStore.findFirst({
      where: { tenantId: ctx.tenantId, userId, storeId: input.storeId },
    });
    if (existing) {
      throw conflict("Usuário já possui acesso a esta unidade", "USER_STORE_EXISTS");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const us = await tx.userStore.create({
        data: {
          tenantId: ctx.tenantId,
          userId,
          storeId: input.storeId,
          storeRoleId: input.storeRoleId ?? null,
        },
        select: { id: true, tenantId: true, userId: true, storeId: true, storeRoleId: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "USER_STORE_GRANTED",
        entity: "UserStore",
        entityId: us.id,
        after: { userId: us.userId, storeId: us.storeId, storeRoleId: us.storeRoleId },
        ip: meta?.ip,
        device: meta?.device,
      });

      return us;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    userId: string,
    storeId: string,
    input: UpdateUserStoreInput,
    meta?: { ip?: string; device?: string },
  ) {
    await this.assertUser(ctx, userId);
    if (input.storeRoleId) await this.assertRole(ctx, input.storeRoleId);

    const existing = await this.prisma.userStore.findFirst({
      where: { tenantId: ctx.tenantId, userId, storeId },
    });
    if (!existing) {
      throw notFound("Acesso do usuário a esta unidade não encontrado", "USER_STORE_NOT_FOUND");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const us = await tx.userStore.update({
        where: { id: existing.id },
        data: { storeRoleId: input.storeRoleId ?? null },
        select: { id: true, tenantId: true, userId: true, storeId: true, storeRoleId: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "USER_STORE_UPDATED",
        entity: "UserStore",
        entityId: us.id,
        before: { storeRoleId: existing.storeRoleId },
        after: { storeRoleId: us.storeRoleId },
        ip: meta?.ip,
        device: meta?.device,
      });

      return us;
    });

    return updated;
  }

  async revoke(
    ctx: TenantContext,
    userId: string,
    storeId: string,
    meta?: { ip?: string; device?: string },
  ) {
    await this.assertUser(ctx, userId);

    const existing = await this.prisma.userStore.findFirst({
      where: { tenantId: ctx.tenantId, userId, storeId },
    });
    if (!existing) {
      throw notFound("Acesso do usuário a esta unidade não encontrado", "USER_STORE_NOT_FOUND");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userStore.delete({ where: { id: existing.id } });

      await new AuditService(tx).log({
        ctx,
        action: "USER_STORE_REVOKED",
        entity: "UserStore",
        entityId: existing.id,
        before: { userId, storeId, storeRoleId: existing.storeRoleId },
        ip: meta?.ip,
        device: meta?.device,
      });
    });

    return { ok: true };
  }

  private async assertUser(ctx: TenantContext, userId: string) {
    const repo = new UserRepository(this.prisma, ctx);
    const user = await repo.findById(userId);
    if (!user) throw notFound("Usuário não encontrado", "USER_NOT_FOUND");
    return user;
  }

  private async assertStore(ctx: TenantContext, storeId: string) {
    const repo = new StoreRepository(this.prisma, ctx);
    const store = await repo.findById(storeId);
    if (!store) throw notFound("Unidade não encontrada", "STORE_NOT_FOUND");
  }

  private async assertRole(ctx: TenantContext, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId: ctx.tenantId, id: roleId },
    });
    if (!role) throw badRequest("Role não pertence a este tenant", "INVALID_ROLES");
    return role;
  }
}