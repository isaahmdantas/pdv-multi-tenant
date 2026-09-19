import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { toDecimal } from "@/lib/money";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { AuditService } from "@/modules/audit/services/audit-service";
import type { AuditTransactionClient } from "@/modules/audit/types";
import { StockBalanceRepository } from "@/modules/inventory/repositories/stock-balance-repository";
import { StockMovementRepository } from "@/modules/inventory/repositories/stock-movement-repository";
import { StockTransferRepository } from "@/modules/inventory/repositories/stock-transfer-repository";
import { toBaseQuantity } from "@/modules/inventory/services/unit-converter";
import type { StockLevel, StockMovementType } from "@/modules/inventory/constants";
import type {
  CreateStockAdjustInput,
  CreateStockEntryInput,
  CreateStockTransferInput,
  UpdateMinMaxInput,
} from "@/modules/inventory/schemas";

export type StockEntryType = "IN" | "OUT";

export interface StockBalanceView {
  storeId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: Prisma.Decimal;
  reservedQuantity: Prisma.Decimal;
  availableQuantity: Prisma.Decimal;
  version: number;
  minStock: Prisma.Decimal;
  maxStock: Prisma.Decimal;
  level: StockLevel;
}

function computeLevel(
  available: Prisma.Decimal,
  minStock: Prisma.Decimal,
  maxStock: Prisma.Decimal,
): StockLevel {
  if (minStock.greaterThan(0) && available.lessThanOrEqualTo(minStock)) return "LOW";
  if (maxStock.greaterThan(0) && available.greaterThanOrEqualTo(maxStock)) return "HIGH";
  return "OK";
}

export class StockService {
  constructor(private readonly prisma: PrismaClient) {}

  private balanceRepo(ctx: TenantContext) {
    return new StockBalanceRepository(this.prisma, ctx);
  }

  private async validateStore(ctx: TenantContext, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { tenantId: ctx.tenantId, id: storeId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!store) throw badRequest("Unidade inválida", "INVALID_STORE");
    return store.id;
  }

  private resolveStore(ctx: TenantContext, storeId?: string) {
    const id = storeId ?? ctx.storeId;
    if (!id) throw badRequest("Informe a unidade (storeId)", "STORE_REQUIRED");
    return this.validateStore(ctx, id);
  }

  private async validateProduct(ctx: TenantContext, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { tenantId: ctx.tenantId, id: productId, status: "ACTIVE" },
      select: { id: true, name: true, sku: true, baseUnitId: true },
    });
    if (!product) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");
    return product;
  }

  private async createMovement(
    tx: AuditTransactionClient,
    ctx: TenantContext,
    params: {
      storeId: string;
      productId: string;
      type: StockEntryType | "ADJUST" | "TRANSFER_IN" | "TRANSFER_OUT";
      quantity: Prisma.Decimal;
      quantityInUnit?: Prisma.Decimal;
      unitOfMeasureId?: string | null;
      balanceAfter: Prisma.Decimal;
      reason?: string | null;
      referenceType?: string | null;
      referenceId?: string | null;
    },
  ) {
    return tx.stockMovement.create({
      data: {
        tenantId: ctx.tenantId,
        storeId: params.storeId,
        productId: params.productId,
        type: params.type,
        quantity: params.quantity,
        quantityInUnit: params.quantityInUnit,
        unitOfMeasureId: params.unitOfMeasureId,
        balanceAfter: params.balanceAfter,
        reason: params.reason ?? null,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
        createdBy: ctx.userId,
      },
    });
  }

  async stockIn(
    ctx: TenantContext,
    storeId: string | undefined,
    data: CreateStockEntryInput,
    meta?: { ip?: string; device?: string },
  ) {
    const resolved = await this.resolveStore(ctx, storeId);
    const product = await this.validateProduct(ctx, data.productId);
    const converted = await toBaseQuantity(
      this.prisma,
      ctx.tenantId,
      product.baseUnitId,
      data.unitOfMeasureId,
      toDecimal(data.quantity),
    );

    return this.prisma.$transaction(async (tx) => {
      const result = await this.balanceRepo(ctx).applyDelta(tx, {
        storeId: resolved,
        productId: product.id,
        delta: converted.quantity,
      });
      await this.createMovement(tx, ctx, {
        storeId: resolved,
        productId: product.id,
        type: "IN",
        quantity: converted.quantity,
        quantityInUnit: converted.quantityInUnit,
        unitOfMeasureId: converted.unitOfMeasureId,
        balanceAfter: result.balanceAfter!,
        reason: data.reason,
      });
      await new AuditService(tx).log({
        ctx,
        action: "STOCK_IN",
        entity: "StockBalance",
        entityId: result.id!,
        after: {
          productId: product.id,
          storeId: resolved,
          quantity: data.quantity,
          unitOfMeasureId: converted.unitOfMeasureId,
        },
        ip: meta?.ip,
        device: meta?.device,
      });
      return result.balanceAfter!;
    });
  }

  async stockOut(
    ctx: TenantContext,
    storeId: string | undefined,
    data: CreateStockEntryInput,
    meta?: { ip?: string; device?: string },
  ) {
    const resolved = await this.resolveStore(ctx, storeId);
    const product = await this.validateProduct(ctx, data.productId);
    const converted = await toBaseQuantity(
      this.prisma,
      ctx.tenantId,
      product.baseUnitId,
      data.unitOfMeasureId,
      toDecimal(data.quantity),
    );

    return this.prisma.$transaction(async (tx) => {
      const result = await this.balanceRepo(ctx).applyDelta(tx, {
        storeId: resolved,
        productId: product.id,
        delta: converted.quantity.negated(),
      });
      if (result.status !== "OK") {
        throw conflict("Estoque insuficiente", "STOCK_INSUFFICIENT");
      }
      await this.createMovement(tx, ctx, {
        storeId: resolved,
        productId: product.id,
        type: "OUT",
        quantity: converted.quantity,
        quantityInUnit: converted.quantityInUnit,
        unitOfMeasureId: converted.unitOfMeasureId,
        balanceAfter: result.balanceAfter!,
        reason: data.reason,
      });
      await new AuditService(tx).log({
        ctx,
        action: "STOCK_OUT",
        entity: "StockBalance",
        entityId: result.id!,
        after: {
          productId: product.id,
          storeId: resolved,
          quantity: data.quantity,
          unitOfMeasureId: converted.unitOfMeasureId,
        },
        ip: meta?.ip,
        device: meta?.device,
      });
      return result.balanceAfter!;
    });
  }

  async adjust(
    ctx: TenantContext,
    storeId: string | undefined,
    data: CreateStockAdjustInput,
    meta?: { ip?: string; device?: string },
  ) {
    const resolved = await this.resolveStore(ctx, storeId);
    const product = await this.validateProduct(ctx, data.productId);
    const delta = toDecimal(data.delta);
    const magnitude = delta.abs();

    return this.prisma.$transaction(async (tx) => {
      const result = await this.balanceRepo(ctx).applyDelta(tx, {
        storeId: resolved,
        productId: product.id,
        delta,
      });
      if (result.status !== "OK") {
        throw conflict("Estoque insuficiente para o ajuste", "STOCK_INSUFFICIENT");
      }
      await this.createMovement(tx, ctx, {
        storeId: resolved,
        productId: product.id,
        type: "ADJUST",
        quantity: magnitude,
        balanceAfter: result.balanceAfter!,
        reason: data.reason,
      });
      await new AuditService(tx).log({
        ctx,
        action: "STOCK_ADJUSTED",
        entity: "StockBalance",
        entityId: result.id!,
        after: { productId: product.id, storeId: resolved, delta: data.delta },
        ip: meta?.ip,
        device: meta?.device,
      });
      return result.balanceAfter!;
    });
  }

  async transfer(
    ctx: TenantContext,
    storeId: string | undefined,
    data: CreateStockTransferInput,
    meta?: { ip?: string; device?: string },
  ) {
    const sourceStoreId = await this.resolveStore(ctx, storeId);
    if (sourceStoreId === data.destinationStoreId) {
      throw badRequest("Origem e destino devem ser diferentes", "SAME_STORE_TRANSFER");
    }
    await this.validateStore(ctx, data.destinationStoreId);

    return this.prisma.$transaction(async (tx) => {
      const prepared = [];
      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: { tenantId: ctx.tenantId, id: item.productId, status: "ACTIVE" },
          select: { id: true, baseUnitId: true },
        });
        if (!product) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");
        const converted = await toBaseQuantity(
          tx,
          ctx.tenantId,
          product.baseUnitId,
          item.unitOfMeasureId,
          toDecimal(item.quantity),
        );
        prepared.push({ productId: product.id, converted });
      }

      const repo = this.balanceRepo(ctx);
      const outResults = [];
      for (const p of prepared) {
        const result = await repo.applyDelta(tx, {
          storeId: sourceStoreId,
          productId: p.productId,
          delta: p.converted.quantity.negated(),
        });
        if (result.status !== "OK") {
          throw conflict("Estoque insuficiente para a transferência", "STOCK_INSUFFICIENT");
        }
        outResults.push(result);
      }

      const transfer = await tx.stockTransfer.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: sourceStoreId,
          destinationStoreId: data.destinationStoreId,
          status: "COMPLETED",
          reason: data.reason ?? null,
          createdBy: ctx.userId,
          completedAt: new Date(),
          items: {
            create: prepared.map((p) => ({
              tenantId: ctx.tenantId,
              productId: p.productId,
              quantity: p.converted.quantity,
              quantityInUnit: p.converted.quantityInUnit,
              unitOfMeasureId: p.converted.unitOfMeasureId,
            })),
          },
        },
        select: { id: true },
      });

      for (let i = 0; i < prepared.length; i++) {
        const p = prepared[i];
        await this.createMovement(tx, ctx, {
          storeId: sourceStoreId,
          productId: p.productId,
          type: "TRANSFER_OUT",
          quantity: p.converted.quantity,
          quantityInUnit: p.converted.quantityInUnit,
          unitOfMeasureId: p.converted.unitOfMeasureId,
          balanceAfter: outResults[i].balanceAfter!,
          reason: data.reason,
          referenceType: "TRANSFER",
          referenceId: transfer.id,
        });
        const destResult = await repo.applyDelta(tx, {
          storeId: data.destinationStoreId,
          productId: p.productId,
          delta: p.converted.quantity,
        });
        await this.createMovement(tx, ctx, {
          storeId: data.destinationStoreId,
          productId: p.productId,
          type: "TRANSFER_IN",
          quantity: p.converted.quantity,
          quantityInUnit: p.converted.quantityInUnit,
          unitOfMeasureId: p.converted.unitOfMeasureId,
          balanceAfter: destResult.balanceAfter!,
          reason: data.reason,
          referenceType: "TRANSFER",
          referenceId: transfer.id,
        });
      }

      await new AuditService(tx).log({
        ctx,
        action: "STOCK_TRANSFER",
        entity: "StockTransfer",
        entityId: transfer.id,
        after: {
          sourceStoreId,
          destinationStoreId: data.destinationStoreId,
          items: prepared.map((p) => ({ productId: p.productId, quantity: p.converted.quantity })),
        },
        ip: meta?.ip,
        device: meta?.device,
      });

      return transfer.id;
    });
  }

  async setMinMax(
    ctx: TenantContext,
    storeId: string | undefined,
    data: UpdateMinMaxInput,
    meta?: { ip?: string; device?: string },
  ) {
    const resolved = await this.resolveStore(ctx, storeId);
    const product = await this.validateProduct(ctx, data.productId);
    const minStock = toDecimal(data.minStock);
    const maxStock = toDecimal(data.maxStock);

    return this.prisma.$transaction(async (tx) => {
      const link = await tx.productStore.upsert({
        where: {
          tenantId_storeId_productId: {
            tenantId: ctx.tenantId,
            storeId: resolved,
            productId: product.id,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          storeId: resolved,
          productId: product.id,
          status: "ACTIVE",
          minStock,
          maxStock,
        },
        update: { minStock, maxStock },
        select: { id: true, minStock: true, maxStock: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "STOCK_MIN_MAX_UPDATED",
        entity: "ProductStore",
        entityId: link.id,
        after: { productId: product.id, storeId: resolved, minStock, maxStock },
        ip: meta?.ip,
        device: meta?.device,
      });
      return link;
    });
  }

  async balance(ctx: TenantContext, storeId: string | undefined, productId: string) {
    const resolved = await this.resolveStore(ctx, storeId);
    const product = await this.validateProduct(ctx, productId);
    const row = await this.balanceRepo(ctx).findBalance(resolved, productId);
    const link = await this.prisma.productStore.findFirst({
      where: { tenantId: ctx.tenantId, storeId: resolved, productId },
      select: { minStock: true, maxStock: true },
    });
    const quantity = row?.quantity ?? new Prisma.Decimal(0);
    const reservedQuantity = row?.reservedQuantity ?? new Prisma.Decimal(0);
    const availableQuantity = row?.availableQuantity ?? new Prisma.Decimal(0);
    const minStock = link?.minStock ?? new Prisma.Decimal(0);
    const maxStock = link?.maxStock ?? new Prisma.Decimal(0);
    return {
      storeId: resolved,
      productId,
      sku: product.sku,
      name: product.name,
      quantity,
      reservedQuantity,
      availableQuantity,
      version: row?.version ?? 0,
      minStock,
      maxStock,
      level: computeLevel(availableQuantity, minStock, maxStock),
    };
  }

  async listAll(
    ctx: TenantContext,
    storeId: string | undefined,
    opts: { search?: string; includeZero?: boolean } = {},
  ) {
    const { search, includeZero = true } = opts;
    const resolved = await this.resolveStore(ctx, storeId);
    const links = await this.prisma.productStore.findMany({
      where: {
        tenantId: ctx.tenantId,
        storeId: resolved,
        status: "ACTIVE",
        ...(search
          ? {
              product: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { sku: { contains: search, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { product: { name: "asc" } },
    });
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        tenantId: ctx.tenantId,
        storeId: resolved,
        productId: { in: links.map((l) => l.productId) },
      },
    });
    const balanceMap = new Map(balances.map((b) => [b.productId, b]));

    const rows: StockBalanceView[] = links.map((link) => {
      const row = balanceMap.get(link.productId);
      const quantity = row?.quantity ?? new Prisma.Decimal(0);
      const reservedQuantity = row?.reservedQuantity ?? new Prisma.Decimal(0);
      const availableQuantity = row?.availableQuantity ?? new Prisma.Decimal(0);
      return {
        storeId: resolved,
        productId: link.productId,
        sku: link.product.sku,
        name: link.product.name,
        quantity,
        reservedQuantity,
        availableQuantity,
        version: row?.version ?? 0,
        minStock: link.minStock,
        maxStock: link.maxStock,
        level: computeLevel(availableQuantity, link.minStock, link.maxStock),
      };
    });

    if (!includeZero) {
      return rows.filter((r) => !r.quantity.isZero());
    }
    return rows;
  }

  async alerts(ctx: TenantContext, storeId: string | undefined) {
    const rows = await this.listAll(ctx, storeId, { includeZero: true });
    return rows.filter((r) => r.level === "LOW" || r.level === "HIGH");
  }

  async history(
    ctx: TenantContext,
    storeId: string | undefined,
    filters: { productId?: string; type?: StockMovementType; limit?: number } = {},
  ) {
    const resolved = await this.resolveStore(ctx, storeId);
    const repo = new StockMovementRepository(this.prisma, ctx);
    return repo.list(resolved, filters);
  }

  async listTransfers(ctx: TenantContext) {
    const repo = new StockTransferRepository(this.prisma, ctx);
    return repo.list();
  }
}