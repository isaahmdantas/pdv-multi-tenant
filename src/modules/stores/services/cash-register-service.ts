import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { CreateCashRegisterInput } from "@/modules/stores/schemas";
import { StoreRepository } from "@/modules/stores/repositories/store-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { conflict, notFound, badRequest } from "@/lib/api/errors";

export class CashRegisterService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext, storeId?: string) {
    if (storeId) await this.assertStoreOfTenant(ctx, storeId);
    return this.prisma.cashRegister.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(storeId ? { storeId } : {}),
        status: "ACTIVE",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        storeId: true,
        name: true,
        status: true,
        createdAt: true,
        store: { select: { name: true, code: true } },
      },
    });
  }

  async get(ctx: TenantContext, id: string) {
    const reg = await this.prisma.cashRegister.findFirst({
      where: { tenantId: ctx.tenantId, id },
    });
    if (!reg) throw notFound("Caixa não encontrado", "CASH_REGISTER_NOT_FOUND");
    return reg;
  }

  async create(
    ctx: TenantContext,
    input: CreateCashRegisterInput,
    meta?: { ip?: string; device?: string },
  ) {
    await this.assertStoreOfTenant(ctx, input.storeId);

    const existing = await this.prisma.cashRegister.findFirst({
      where: {
        tenantId: ctx.tenantId,
        storeId: input.storeId,
        name: input.name,
      },
    });
    if (existing) {
      throw conflict("Já existe um caixa com este nome na unidade", "CASH_REGISTER_TAKEN");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const reg = await tx.cashRegister.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: input.storeId,
          name: input.name,
        },
        select: { id: true, tenantId: true, storeId: true, name: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "CASH_REGISTER_CREATED",
        entity: "CashRegister",
        entityId: reg.id,
        after: { storeId: reg.storeId, name: reg.name },
        ip: meta?.ip,
        device: meta?.device,
      });

      return reg;
    });

    return created;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const existing = await this.get(ctx, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const reg = await tx.cashRegister.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, tenantId: true, storeId: true, name: true, status: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "CASH_REGISTER_DEACTIVATED",
        entity: "CashRegister",
        entityId: reg.id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });

      return reg;
    });

    return updated;
  }

  private async assertStoreOfTenant(ctx: TenantContext, storeId: string) {
    const repo = new StoreRepository(this.prisma, ctx);
    const store = await repo.findById(storeId);
    if (!store) throw badRequest("Unidade não pertence a este tenant", "STORE_NOT_FOUND");
  }
}