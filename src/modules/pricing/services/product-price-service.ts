import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type {
  CreateProductPriceInput,
  UpdateProductPriceInput,
} from "@/modules/pricing/schemas";
import { toDecimal } from "@/lib/money";
import { PriceTableRepository } from "@/modules/pricing/repositories/price-table-repository";
import { ProductPriceRepository } from "@/modules/pricing/repositories/product-price-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { badRequest, conflict, notFound } from "@/lib/api/errors";

type CreateProductPriceData = Omit<CreateProductPriceInput, "unitPrice"> & {
  unitPrice: string | number;
};

type UpdateProductPriceData = Omit<UpdateProductPriceInput, "unitPrice"> & {
  unitPrice?: string | number;
};

function toNumber(value?: Prisma.Decimal | string | number | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  return parseFloat(value.toString());
}

function rangesOverlap(
  emin: Prisma.Decimal | string | number | null | undefined,
  emax: Prisma.Decimal | string | number | null | undefined,
  nmin: Prisma.Decimal | string | number | null | undefined,
  nmax: Prisma.Decimal | string | number | null | undefined,
): boolean {
  const eMin = toNumber(emin) ?? 0;
  const nMin = toNumber(nmin) ?? 0;
  const eMax = toNumber(emax) ?? Infinity;
  const nMax = toNumber(nmax) ?? Infinity;
  return !(eMax < nMin || nMax < eMin);
}

export class ProductPriceService {
  constructor(private readonly prisma: PrismaClient) {}

  private mapRow(row: Awaited<ReturnType<ProductPriceRepository["findById"]>>) {
    if (!row) return null;
    return {
      id: row.id,
      priceTable: row.priceTable,
      product: row.product,
      unitPrice: row.unitPrice,
      minimumQuantity: row.minimumQuantity,
      maximumQuantity: row.maximumQuantity,
    };
  }

  async listByTable(ctx: TenantContext, priceTableId: string) {
    const table = await new PriceTableRepository(this.prisma, ctx).findById(priceTableId);
    if (!table) throw notFound("Tabela de preço não encontrada", "PRICE_TABLE_NOT_FOUND");

    const repo = new ProductPriceRepository(this.prisma, ctx);
    const rows = await repo.listByTable(priceTableId);
    return rows
      .map((row) => this.mapRow(row))
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  async create(ctx: TenantContext, input: CreateProductPriceData, meta?: { ip?: string; device?: string }) {
    const table = await new PriceTableRepository(this.prisma, ctx).findById(input.priceTableId);
    if (!table) throw badRequest("Tabela de preço inválida", "INVALID_PRICE_TABLE");

    const product = await this.prisma.product.findFirst({
      where: { tenantId: ctx.tenantId, id: input.productId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!product) throw badRequest("Produto inválido", "INVALID_PRODUCT");

    const repo = new ProductPriceRepository(this.prisma, ctx);
    const existing = await repo.listByTable(input.priceTableId);
    if (existing.some((row) => row.productId === input.productId && rangesOverlap(row.minimumQuantity, row.maximumQuantity, input.minimumQuantity, input.maximumQuantity))) {
      throw conflict(
        "Faixa de quantidade sobrepõe outra faixa já cadastrada para este produto na tabela",
        "PRODUCT_PRICE_RANGE_CONFLICT",
      );
    }

    const unitPrice = toDecimal(input.unitPrice);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.productPrice.create({
        data: {
          tenantId: ctx.tenantId,
          priceTableId: input.priceTableId,
          productId: input.productId,
          unitPrice,
          minimumQuantity: input.minimumQuantity !== undefined && input.minimumQuantity !== null
            ? toDecimal(input.minimumQuantity)
            : null,
          maximumQuantity: input.maximumQuantity !== undefined && input.maximumQuantity !== null
            ? toDecimal(input.maximumQuantity)
            : null,
        },
        select: { id: true, productId: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_PRICE_CREATED",
        entity: "ProductPrice",
        entityId: row.id,
        after: {
          priceTableId: input.priceTableId,
          productId: row.productId,
          unitPrice: unitPrice.toString(),
          minimumQuantity: input.minimumQuantity ?? null,
          maximumQuantity: input.maximumQuantity ?? null,
        },
        ip: meta?.ip,
        device: meta?.device,
      });

      return row;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateProductPriceData,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new ProductPriceRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Preço de produto não encontrado", "PRODUCT_PRICE_NOT_FOUND");

    const data: Record<string, unknown> = {};
    if (input.unitPrice !== undefined) data.unitPrice = toDecimal(input.unitPrice);
    if (input.minimumQuantity !== undefined) data.minimumQuantity = input.minimumQuantity === null ? null : toDecimal(input.minimumQuantity);
    if (input.maximumQuantity !== undefined) data.maximumQuantity = input.maximumQuantity === null ? null : toDecimal(input.maximumQuantity);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.productPrice.update({
        where: { id },
        data,
        select: { id: true, productId: true, unitPrice: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_PRICE_UPDATED",
        entity: "ProductPrice",
        entityId: id,
        before: { unitPrice: existing.unitPrice.toString() },
        after: { unitPrice: row.unitPrice.toString() },
        ip: meta?.ip,
        device: meta?.device,
      });

      return row;
    });

    return updated;
  }

  async remove(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new ProductPriceRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Preço de produto não encontrado", "PRODUCT_PRICE_NOT_FOUND");

    await this.prisma.$transaction(async (tx) => {
      await tx.productPrice.delete({ where: { id } });
      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_PRICE_DELETED",
        entity: "ProductPrice",
        entityId: id,
        before: {
          priceTableId: existing.priceTableId,
          productId: existing.productId,
          unitPrice: existing.unitPrice.toString(),
        },
        ip: meta?.ip,
        device: meta?.device,
      });
    });
  }
}