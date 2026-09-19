import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { toDecimal } from "@/lib/money";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { AuditService } from "@/modules/audit/services/audit-service";
import { InventoryRepository } from "@/modules/inventory/repositories/inventory-repository";
import { StockBalanceRepository } from "@/modules/inventory/repositories/stock-balance-repository";
import type {
  CloseInventoryInput,
  OpenInventoryInput,
} from "@/modules/inventory/schemas";

export class InventoryService {
  constructor(private readonly prisma: PrismaClient) {}

  private async validateStore(ctx: TenantContext, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { tenantId: ctx.tenantId, id: storeId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!store) throw badRequest("Unidade inválida", "INVALID_STORE");
    return store.id;
  }

  private async resolveStore(ctx: TenantContext, storeId?: string) {
    const id = storeId ?? ctx.storeId;
    if (!id) throw badRequest("Informe a unidade (storeId)", "STORE_REQUIRED");
    return this.validateStore(ctx, id);
  }

  async open(
    ctx: TenantContext,
    storeId: string | undefined,
    data: OpenInventoryInput,
    meta?: { ip?: string; device?: string },
  ) {
    const resolved = await this.resolveStore(ctx, storeId);

    const existing = await this.prisma.inventory.findFirst({
      where: { tenantId: ctx.tenantId, storeId: resolved, status: "OPEN" },
      select: { id: true },
    });
    if (existing) throw conflict("Já existe um inventário aberto para esta unidade", "INVENTORY_OPEN_EXISTS");

    const productLinks = await this.prisma.productStore.findMany({
      where: { tenantId: ctx.tenantId, storeId: resolved, status: "ACTIVE" },
      select: { productId: true },
    });
    const productIds = productLinks.map((l) => l.productId);
    const balances = productIds.length
      ? await this.prisma.stockBalance.findMany({
          where: { tenantId: ctx.tenantId, storeId: resolved, productId: { in: productIds } },
          select: { productId: true, quantity: true },
        })
      : [];
    const balanceMap = new Map(balances.map((b) => [b.productId, b.quantity]));

    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: resolved,
          status: "OPEN",
          notes: data.notes ?? null,
          createdBy: ctx.userId,
          items: {
            create: productIds.map((productId) => ({
              tenantId: ctx.tenantId,
              productId,
              expectedQuantity: balanceMap.get(productId) ?? new Prisma.Decimal(0),
            })),
          },
        },
        include: {
          store: { select: { id: true, name: true, code: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });
      await new AuditService(tx).log({
        ctx,
        action: "INVENTORY_CREATED",
        entity: "Inventory",
        entityId: inventory.id,
        after: { storeId: resolved, items: inventory.items.length },
        ip: meta?.ip,
        device: meta?.device,
      });
      return inventory;
    });
  }

  async list(ctx: TenantContext, storeId: string | undefined, includeClosed = false) {
    const resolved = await this.resolveStore(ctx, storeId);
    const repo = new InventoryRepository(this.prisma, ctx);
    return repo.list(resolved, includeClosed);
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new InventoryRepository(this.prisma, ctx);
    const inventory = await repo.findById(id);
    if (!inventory) throw notFound("Inventário não encontrado", "INVENTORY_NOT_FOUND");
    return inventory;
  }

  async close(
    ctx: TenantContext,
    id: string,
    data: CloseInventoryInput,
    meta?: { ip?: string; device?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findFirst({
        where: { tenantId: ctx.tenantId, id, status: "OPEN" },
        include: {
          items: { select: { id: true, productId: true, expectedQuantity: true } },
        },
      });
      if (!inventory) {
        const maybe = await tx.inventory.findFirst({
          where: { tenantId: ctx.tenantId, id },
          select: { status: true },
        });
        if (maybe && maybe.status === "CLOSED") {
          throw conflict("Inventário já foi encerrado", "INVENTORY_ALREADY_CLOSED");
        }
        throw notFound("Inventário não encontrado", "INVENTORY_NOT_FOUND");
      }

      const countedMap = new Map(data.items.map((i) => [i.productId, i.countedQuantity]));
      const incomplete = inventory.items.filter((item) => !countedMap.has(item.productId));
      if (incomplete.length > 0) {
        throw badRequest(
          "Todos os itens do inventário devem ser informados na contagem",
          "INVENTORY_ITEMS_INCOMPLETE",
        );
      }

      const repo = new StockBalanceRepository(this.prisma, ctx);
      const differences = [];

      for (const item of inventory.items) {
        const countedRaw = countedMap.get(item.productId)!;
        const counted = toDecimal(countedRaw);
        const difference = counted.sub(item.expectedQuantity);
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { countedQuantity: counted, difference },
        });
        differences.push({
          productId: item.productId,
          expectedQuantity: item.expectedQuantity,
          countedQuantity: counted,
          difference,
        });

        if (!difference.isZero()) {
          const result = await repo.applyDelta(tx, {
            storeId: inventory.storeId,
            productId: item.productId,
            delta: difference,
          });
          if (result.status !== "OK") {
            throw conflict(
              "Estoque insuficiente para aplicar a diferença apontada",
              "STOCK_INSUFFICIENT",
            );
          }
          await tx.stockMovement.create({
            data: {
              tenantId: ctx.tenantId,
              storeId: inventory.storeId,
              productId: item.productId,
              type: "ADJUST",
              quantity: difference.abs(),
              balanceAfter: result.balanceAfter!,
              reason: data.notes ?? "Ajuste por inventário",
              referenceType: "INVENTORY",
              referenceId: inventory.id,
              createdBy: ctx.userId,
            },
          });
        }
      }

      const closed = await tx.inventory.update({
        where: { id: inventory.id },
        data: { status: "CLOSED", finishedAt: new Date(), notes: data.notes ?? inventory.notes ?? null },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });

      await new AuditService(tx).log({
        ctx,
        action: "INVENTORY_CLOSED",
        entity: "Inventory",
        entityId: inventory.id,
        before: { status: "OPEN" },
        after: { status: "CLOSED", items: differences },
        ip: meta?.ip,
        device: meta?.device,
      });

      return closed;
    });
  }
}