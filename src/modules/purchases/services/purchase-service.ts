import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type {
  CreatePurchaseInput,
  UpdatePurchaseInput,
} from "@/modules/purchases/schemas";
import { toDecimal } from "@/lib/money";
import { PurchaseRepository } from "@/modules/purchases/repositories/purchase-repository";
import { StockBalanceRepository } from "@/modules/inventory/repositories/stock-balance-repository";
import { toBaseQuantity } from "@/modules/inventory/services/unit-converter";
import { AuditService } from "@/modules/audit/services/audit-service";
import { badRequest, conflict, notFound } from "@/lib/api/errors";

interface ItemData {
  productId: string;
  quantity: string | number;
  unitOfMeasureId?: string | null;
  unitCost: string | number;
  batchNumber?: string | null;
  expiryDate?: Date | null;
}

export class PurchaseService {
  constructor(private readonly prisma: PrismaClient) {}

  private repo(ctx: TenantContext) {
    return new PurchaseRepository(this.prisma, ctx);
  }

  list(ctx: TenantContext, opts: { storeId?: string; status?: string } = {}) {
    return this.repo(ctx).list(opts.storeId, opts.status);
  }

  async get(ctx: TenantContext, id: string) {
    const row = await this.repo(ctx).findById(id);
    if (!row) throw notFound("Pedido de compra não encontrado", "PURCHASE_NOT_FOUND");
    return row;
  }

  private async validateStore(ctx: TenantContext, storeId?: string | null) {
    const id = storeId ?? ctx.storeId;
    if (!id) throw badRequest("Informe a unidade (storeId)", "STORE_REQUIRED");
    const store = await this.prisma.store.findFirst({
      where: { tenantId: ctx.tenantId, id, status: "ACTIVE" },
      select: { id: true },
    });
    if (!store) throw badRequest("Unidade inválida", "INVALID_STORE");
    return id;
  }

  private async validateSupplier(ctx: TenantContext, supplierId?: string | null) {
    if (!supplierId) return;
    const supplier = await this.prisma.supplier.findFirst({
      where: { tenantId: ctx.tenantId, id: supplierId, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (!supplier) throw badRequest("Fornecedor inválido", "INVALID_SUPPLIER");
    return supplier;
  }

  private async loadProducts(ctx: TenantContext, items: { productId: string }[]) {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { tenantId: ctx.tenantId, id: { in: ids }, status: "ACTIVE" },
      select: { id: true, name: true, baseUnitId: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const item of items) {
      if (!byId.has(item.productId)) {
        throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");
      }
    }
    return byId;
  }

  private buildItems(items: ItemData[], products: Map<string, { id: string; baseUnitId: string }>) {
    return items.map((item) => {
      const quantity = toDecimal(item.quantity);
      const unitCost = toDecimal(item.unitCost);
      return {
        productId: item.productId,
        quantity,
        quantityInUnit: quantity,
        unitOfMeasureId: item.unitOfMeasureId ?? null,
        unitCost,
        totalCost: quantity.mul(unitCost),
        batchNumber: item.batchNumber ?? null,
        expiryDate: item.expiryDate ?? null,
        productBaseUnitId: products.get(item.productId)!.baseUnitId,
      };
    });
  }

  async create(ctx: TenantContext, input: CreatePurchaseInput, meta?: { ip?: string; device?: string }) {
    const storeId = await this.validateStore(ctx, input.storeId);
    const supplier = await this.validateSupplier(ctx, input.supplierId);
    const products = await this.loadProducts(ctx, input.items);
    const items = this.buildItems(input.items, products);
    const totalAmount = items.reduce((acc, i) => acc.add(i.totalCost), toDecimal(0));

    const created = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          tenantId: ctx.tenantId,
          storeId,
          supplierId: supplier?.id ?? null,
          status: "ORDERED",
          totalAmount,
          notes: input.notes ?? null,
          expectedAt: input.expectedAt ?? null,
          createdBy: ctx.userId,
          items: {
            create: items.map((i) => ({
              tenantId: ctx.tenantId,
              productId: i.productId,
              quantity: i.quantity,
              quantityInUnit: i.quantityInUnit,
              unitOfMeasureId: i.unitOfMeasureId,
              unitCost: i.unitCost,
              totalCost: i.totalCost,
              batchNumber: i.batchNumber,
              expiryDate: i.expiryDate,
            })),
          },
        },
        select: { id: true, totalAmount: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PURCHASE_CREATED",
        entity: "Purchase",
        entityId: purchase.id,
        after: { status: "ORDERED", storeId, supplierId: supplier?.id ?? null, totalAmount },
        ip: meta?.ip,
        device: meta?.device,
      });

      return purchase;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdatePurchaseInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = this.repo(ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Pedido de compra não encontrado", "PURCHASE_NOT_FOUND");
    if (existing.status !== "ORDERED") {
      throw conflict("Apenas pedidos em andamento podem ser editados", "PURCHASE_NOT_EDITABLE");
    }

    let storeId = existing.storeId;
    if (input.storeId !== undefined) storeId = await this.validateStore(ctx, input.storeId);
    const supplier = input.supplierId !== undefined ? await this.validateSupplier(ctx, input.supplierId) : undefined;
    const supplierId = supplier === undefined ? existing.supplierId : (supplier?.id ?? null);

    let buildItems: ReturnType<typeof this.buildItems> | undefined;
    if (input.items) {
      const products = await this.loadProducts(ctx, input.items);
      buildItems = this.buildItems(input.items, products);
    }

    const data: Prisma.PurchaseUncheckedUpdateInput = {};
    if (input.storeId !== undefined) data.storeId = storeId;
    if (input.supplierId !== undefined) data.supplierId = supplierId;
    if (input.expectedAt !== undefined) data.expectedAt = input.expectedAt ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const totalAmount = buildItems
      ? buildItems.reduce((acc, i) => acc.add(i.totalCost), toDecimal(0))
      : existing.totalAmount;
    data.totalAmount = totalAmount;
    if (buildItems) {
      const existingIds = existing.items.map((i) => i.id);
      data.items = {
        deleteMany: { id: { in: existingIds } },
        create: buildItems.map((i) => ({
          tenantId: ctx.tenantId,
          productId: i.productId,
          quantity: i.quantity,
          quantityInUnit: i.quantityInUnit,
          unitOfMeasureId: i.unitOfMeasureId,
          unitCost: i.unitCost,
          totalCost: i.totalCost,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate,
        })),
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({
        where: { id },
        data,
      });

      await new AuditService(tx).log({
        ctx,
        action: "PURCHASE_UPDATED",
        entity: "Purchase",
        entityId: id,
        before: { status: existing.status, totalAmount: existing.totalAmount },
        after: { status: purchase.status, totalAmount: purchase.totalAmount },
        ip: meta?.ip,
        device: meta?.device,
      });

      return purchase;
    });

    return updated;
  }

  async cancel(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = this.repo(ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Pedido de compra não encontrado", "PURCHASE_NOT_FOUND");
    if (existing.status !== "ORDERED") {
      throw conflict("Apenas pedidos em andamento podem ser cancelados", "PURCHASE_NOT_CANCELLABLE");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({
        where: { id },
        data: { status: "CANCELLED" },
        select: { id: true, status: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PURCHASE_CANCELLED",
        entity: "Purchase",
        entityId: id,
        before: { status: existing.status },
        after: { status: "CANCELLED" },
        ip: meta?.ip,
        device: meta?.device,
      });

      return purchase;
    });

    return updated;
  }

  async receive(
    ctx: TenantContext,
    id: string,
    input: { items?: { productId: string; batchNumber?: string | null; expiryDate?: Date | null }[] },
    meta?: { ip?: string; device?: string },
  ) {
    const repo = this.repo(ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Pedido de compra não encontrado", "PURCHASE_NOT_FOUND");
    if (existing.status !== "ORDERED") {
      throw conflict("Apenas pedidos em andamento podem ser recebidos", "PURCHASE_NOT_RECEIVABLE");
    }

    const receiveMap = new Map((input.items ?? []).map((i) => [i.productId, i]));
    const balanceRepo = new StockBalanceRepository(this.prisma, ctx);

    await this.prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        const converted = await toBaseQuantity(
          tx,
          ctx.tenantId,
          item.product.baseUnitId,
          item.unitOfMeasureId,
          item.quantity,
        );
        const result = await balanceRepo.applyDelta(tx, {
          storeId: existing.storeId,
          productId: item.productId,
          delta: converted.quantity,
        });
        if (result.status !== "OK") {
          throw conflict("Não foi possível dar entrada no estoque", "STOCK_APPLY_FAILED");
        }

        const overrides = receiveMap.get(item.productId);
        const batchNumber =
          overrides?.batchNumber !== undefined ? (overrides.batchNumber ?? null) : item.batchNumber;
        const expiryDate =
          overrides?.expiryDate !== undefined ? (overrides.expiryDate ?? null) : item.expiryDate;

        await tx.purchaseItem.update({
          where: { id: item.id },
          data: {
            quantityInUnit: converted.quantityInUnit,
            unitOfMeasureId: converted.unitOfMeasureId,
            batchNumber,
            expiryDate,
          },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: existing.storeId,
            productId: item.productId,
            type: "IN",
            quantity: converted.quantity,
            quantityInUnit: converted.quantityInUnit,
            unitOfMeasureId: converted.unitOfMeasureId,
            balanceAfter: result.balanceAfter!,
            reason: "Entrada por pedido de compra",
            referenceType: "PURCHASE",
            referenceId: id,
            createdBy: ctx.userId,
          },
        });
      }

      await tx.purchase.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PURCHASE_RECEIVED",
        entity: "Purchase",
        entityId: id,
        before: { status: existing.status },
        after: { status: "RECEIVED", storeId: existing.storeId },
        ip: meta?.ip,
        device: meta?.device,
      });
    });

    return this.get(ctx, id);
  }
}