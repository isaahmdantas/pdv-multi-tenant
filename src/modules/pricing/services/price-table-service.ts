import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type {
  CreatePriceTableInput,
  UpdatePriceTableInput,
} from "@/modules/pricing/schemas";
import { toDecimal } from "@/lib/money";
import { PriceTableRepository } from "@/modules/pricing/repositories/price-table-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { badRequest, conflict, notFound } from "@/lib/api/errors";

type CreatePriceTableData = Omit<
  CreatePriceTableInput,
  "defaultPrice" | "priority" | "active"
> & {
  defaultPrice?: string | number;
  priority?: number;
  active?: boolean;
};

type UpdatePriceTableData = Omit<
  UpdatePriceTableInput,
  "defaultPrice" | "priority" | "active"
> & {
  defaultPrice?: string | number;
  priority?: number;
  active?: boolean;
};

export class PriceTableService {
  constructor(private readonly prisma: PrismaClient) {}

  private mapTable(
    row: Awaited<ReturnType<PriceTableRepository["findById"]>>,
  ) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      store: row.store,
      customerCategory: row.customerCategory,
      defaultPrice: row.defaultPrice,
      priority: row.priority,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      active: row.active,
    };
  }

  async list(ctx: TenantContext, opts: { includeInactive?: boolean } = {}) {
    const repo = new PriceTableRepository(this.prisma, ctx);
    const rows = await repo.list(opts.includeInactive);
    return rows
      .map((row) => this.mapTable(row))
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new PriceTableRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Tabela de preço não encontrada", "PRICE_TABLE_NOT_FOUND");
    return this.mapTable(row);
  }

  private async validateRefs(
    ctx: TenantContext,
    refs: { storeId?: string | null; customerCategoryId?: string | null },
  ) {
    if (refs.storeId) {
      const store = await this.prisma.store.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.storeId },
        select: { id: true },
      });
      if (!store) throw badRequest("Unidade inválida", "INVALID_STORE");
    }
    if (refs.customerCategoryId) {
      const cat = await this.prisma.customerCategory.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.customerCategoryId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!cat) throw badRequest("Categoria de cliente inválida", "INVALID_CATEGORY");
    }
  }

  async create(ctx: TenantContext, input: CreatePriceTableData, meta?: { ip?: string; device?: string }) {
    const repo = new PriceTableRepository(this.prisma, ctx);

    if (await repo.findByName(input.name)) {
      throw conflict("Já existe uma tabela com este nome", "PRICE_TABLE_TAKEN");
    }

    await this.validateRefs(ctx, {
      storeId: input.storeId,
      customerCategoryId: input.customerCategoryId,
    });

    const defaultPrice = toDecimal(input.defaultPrice ?? "0");
    const validFrom = input.validFrom ?? new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const table = await tx.priceTable.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          description: input.description ?? null,
          storeId: input.storeId ?? null,
          customerCategoryId: input.customerCategoryId ?? null,
          defaultPrice,
          priority: input.priority ?? 0,
          validFrom,
          validUntil: input.validUntil ?? null,
          active: input.active ?? true,
        },
        select: { id: true, name: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PRICE_TABLE_CREATED",
        entity: "PriceTable",
        entityId: table.id,
        after: { name: table.name, defaultPrice: defaultPrice.toString() },
        ip: meta?.ip,
        device: meta?.device,
      });

      return table;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdatePriceTableData,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new PriceTableRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Tabela de preço não encontrada", "PRICE_TABLE_NOT_FOUND");

    if (input.name && input.name !== existing.name) {
      const taken = await repo.findByName(input.name);
      if (taken) throw conflict("Já existe uma tabela com este nome", "PRICE_TABLE_TAKEN");
    }

    await this.validateRefs(ctx, {
      storeId: input.storeId,
      customerCategoryId: input.customerCategoryId,
    });

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.storeId !== undefined) data.storeId = input.storeId ?? null;
    if (input.customerCategoryId !== undefined) data.customerCategoryId = input.customerCategoryId ?? null;
    if (input.defaultPrice !== undefined) data.defaultPrice = toDecimal(input.defaultPrice);
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.validFrom !== undefined) data.validFrom = input.validFrom;
    if (input.validUntil !== undefined) data.validUntil = input.validUntil ?? null;
    if (input.active !== undefined) data.active = input.active;

    const updated = await this.prisma.$transaction(async (tx) => {
      const table = await tx.priceTable.update({
        where: { id },
        data,
        select: { id: true, name: true, active: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PRICE_TABLE_UPDATED",
        entity: "PriceTable",
        entityId: id,
        before: { name: existing.name, active: existing.active },
        after: { name: table.name, active: table.active },
        ip: meta?.ip,
        device: meta?.device,
      });

      return table;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new PriceTableRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Tabela de preço não encontrada", "PRICE_TABLE_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const table = await tx.priceTable.update({
        where: { id },
        data: { active: false },
        select: { id: true, name: true, active: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PRICE_TABLE_DEACTIVATED",
        entity: "PriceTable",
        entityId: id,
        before: { name: existing.name, active: existing.active },
        after: { name: table.name, active: false },
        ip: meta?.ip,
        device: meta?.device,
      });

      return table;
    });

    return updated;
  }
}