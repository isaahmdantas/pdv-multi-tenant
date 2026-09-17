import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { CreateTerminalInput } from "@/modules/stores/schemas";
import { StoreRepository } from "@/modules/stores/repositories/store-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { conflict, notFound, badRequest } from "@/lib/api/errors";

export class TerminalService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext, storeId?: string) {
    if (storeId) await this.assertStoreOfTenant(ctx, storeId);
    return this.prisma.terminal.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(storeId ? { storeId } : {}),
        status: "ACTIVE",
      },
      orderBy: { code: "asc" },
      select: {
        id: true,
        storeId: true,
        name: true,
        code: true,
        mode: true,
        status: true,
        createdAt: true,
        store: { select: { name: true, code: true } },
      },
    });
  }

  async get(ctx: TenantContext, id: string) {
    const term = await this.prisma.terminal.findFirst({
      where: { tenantId: ctx.tenantId, id },
    });
    if (!term) throw notFound("Terminal não encontrado", "TERMINAL_NOT_FOUND");
    return term;
  }

  async create(
    ctx: TenantContext,
    input: CreateTerminalInput,
    meta?: { ip?: string; device?: string },
  ) {
    await this.assertStoreOfTenant(ctx, input.storeId);

    const existing = await this.prisma.terminal.findFirst({
      where: { tenantId: ctx.tenantId, code: input.code },
    });
    if (existing) {
      throw conflict("Já existe um terminal com este código", "TERMINAL_TAKEN");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const term = await tx.terminal.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: input.storeId,
          name: input.name,
          code: input.code,
          mode: input.mode,
        },
        select: { id: true, tenantId: true, storeId: true, name: true, code: true, mode: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "TERMINAL_CREATED",
        entity: "Terminal",
        entityId: term.id,
        after: { storeId: term.storeId, name: term.name, code: term.code, mode: term.mode },
        ip: meta?.ip,
        device: meta?.device,
      });

      return term;
    });

    return created;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const existing = await this.get(ctx, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const term = await tx.terminal.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, tenantId: true, storeId: true, name: true, code: true, status: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "TERMINAL_DEACTIVATED",
        entity: "Terminal",
        entityId: term.id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });

      return term;
    });

    return updated;
  }

  private async assertStoreOfTenant(ctx: TenantContext, storeId: string) {
    const repo = new StoreRepository(this.prisma, ctx);
    const store = await repo.findById(storeId);
    if (!store) throw badRequest("Unidade não pertence a este tenant", "STORE_NOT_FOUND");
  }
}