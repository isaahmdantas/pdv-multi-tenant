import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type {
  CreatePromotionInput,
  UpdatePromotionInput,
} from "@/modules/pricing/schemas";
import { toDecimal } from "@/lib/money";
import { PromotionRepository } from "@/modules/pricing/repositories/promotion-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { badRequest, notFound } from "@/lib/api/errors";

type CreatePromotionData = Omit<CreatePromotionInput, "discountValue" | "active"> & {
  discountValue: string | number;
  active?: boolean;
};

type UpdatePromotionData = Omit<UpdatePromotionInput, "discountValue" | "active"> & {
  discountValue?: string | number;
  active?: boolean;
};

export class PromotionService {
  constructor(private readonly prisma: PrismaClient) {}

  private mapPromotion(
    row: Awaited<ReturnType<PromotionRepository["findById"]>>,
  ) {
    if (!row) return null;
    return {
      id: row.id,
      store: row.store,
      product: row.product,
      customerCategory: row.customerCategory,
      discountType: row.discountType,
      discountValue: row.discountValue,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      active: row.active,
    };
  }

  async list(ctx: TenantContext, opts: { includeInactive?: boolean } = {}) {
    const repo = new PromotionRepository(this.prisma, ctx);
    const rows = await repo.list(opts.includeInactive);
    return rows
      .map((row) => this.mapPromotion(row))
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new PromotionRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Promoção não encontrada", "PROMOTION_NOT_FOUND");
    return this.mapPromotion(row);
  }

  private async validateRefs(
    ctx: TenantContext,
    refs: { storeId?: string | null; productId?: string | null; customerCategoryId?: string | null },
  ) {
    if (refs.storeId) {
      const store = await this.prisma.store.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.storeId },
        select: { id: true },
      });
      if (!store) throw badRequest("Unidade inválida", "INVALID_STORE");
    }
    if (refs.productId) {
      const product = await this.prisma.product.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.productId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!product) throw badRequest("Produto inválido", "INVALID_PRODUCT");
    }
    if (refs.customerCategoryId) {
      const cat = await this.prisma.customerCategory.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.customerCategoryId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!cat) throw badRequest("Categoria de cliente inválida", "INVALID_CATEGORY");
    }
  }

  async create(ctx: TenantContext, input: CreatePromotionData, meta?: { ip?: string; device?: string }) {
    await this.validateRefs(ctx, {
      storeId: input.storeId,
      productId: input.productId,
      customerCategoryId: input.customerCategoryId,
    });

    const discountValue = toDecimal(input.discountValue);
    const validFrom = input.validFrom ?? new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: input.storeId ?? null,
          productId: input.productId ?? null,
          customerCategoryId: input.customerCategoryId ?? null,
          discountType: input.discountType,
          discountValue,
          validFrom,
          validUntil: input.validUntil ?? null,
          active: input.active ?? true,
        },
        select: { id: true, discountType: true, discountValue: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PROMOTION_CREATED",
        entity: "Promotion",
        entityId: promotion.id,
        after: {
          discountType: promotion.discountType,
          discountValue: promotion.discountValue.toString(),
        },
        ip: meta?.ip,
        device: meta?.device,
      });

      return promotion;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdatePromotionData,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new PromotionRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Promoção não encontrada", "PROMOTION_NOT_FOUND");

    await this.validateRefs(ctx, {
      storeId: input.storeId,
      productId: input.productId,
      customerCategoryId: input.customerCategoryId,
    });

    const data: Record<string, unknown> = {};
    if (input.storeId !== undefined) data.storeId = input.storeId ?? null;
    if (input.productId !== undefined) data.productId = input.productId ?? null;
    if (input.customerCategoryId !== undefined) data.customerCategoryId = input.customerCategoryId ?? null;
    if (input.discountType !== undefined) data.discountType = input.discountType;
    if (input.discountValue !== undefined) data.discountValue = toDecimal(input.discountValue);
    if (input.validFrom !== undefined) data.validFrom = input.validFrom;
    if (input.validUntil !== undefined) data.validUntil = input.validUntil ?? null;
    if (input.active !== undefined) data.active = input.active;

    const updated = await this.prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.update({
        where: { id },
        data,
        select: { id: true, discountType: true, discountValue: true, active: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PROMOTION_UPDATED",
        entity: "Promotion",
        entityId: id,
        before: {
          discountType: existing.discountType,
          discountValue: existing.discountValue.toString(),
        },
        after: {
          discountType: promotion.discountType,
          discountValue: promotion.discountValue.toString(),
          active: promotion.active,
        },
        ip: meta?.ip,
        device: meta?.device,
      });

      return promotion;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new PromotionRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Promoção não encontrada", "PROMOTION_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.update({
        where: { id },
        data: { active: false },
        select: { id: true, discountType: true, discountValue: true, active: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PROMOTION_DEACTIVATED",
        entity: "Promotion",
        entityId: id,
        before: { active: existing.active },
        after: { active: false },
        ip: meta?.ip,
        device: meta?.device,
      });

      return promotion;
    });

    return updated;
  }
}