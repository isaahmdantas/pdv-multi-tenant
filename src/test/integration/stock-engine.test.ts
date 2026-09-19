// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { StockService } from "@/modules/inventory/services/stock-service";
import { StockBalanceRepository } from "@/modules/inventory/repositories/stock-balance-repository";

const TRUNCATE_TABLES = [
  "AuditLog",
  "StockBalance",
  "StockMovement",
  "StockTransferItem",
  "StockTransfer",
  "InventoryItem",
  "Inventory",
  "ProductStore",
  "ProductBarcode",
  "Product",
  "ProductCategory",
  "UnitConversion",
  "UnitOfMeasure",
  "Customer",
  "CustomerCategory",
  "UserStore",
  "UserRole",
  "RolePermission",
  "User",
  "Role",
  "Permission",
  "Store",
  "Tenant",
];

describe("Estoque — concorrência atômica e optimistic (F8-11)", () => {
  let db: PrismaClient;
  let ctx: TenantContext;
  let productId: string;

  beforeAll(async () => {
    db = createTestDb();
    await db.$executeRawUnsafe(
      `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
    );

    const tenant = await db.tenant.create({ data: { name: "Tenant A", slug: "tenant-a" } });
    const store = await db.store.create({
      data: { tenantId: tenant.id, name: "Loja A1", code: "A1" },
      select: { id: true },
    });
    const role = await db.role.create({
      data: { tenantId: tenant.id, name: "ADMIN", globalStoreAccess: true },
    });
    const user = await db.user.create({
      data: { tenantId: tenant.id, name: "Admin", email: "admin@a.local", passwordHash: "hash" },
      select: { id: true },
    });
    await db.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: role.id } });
    await db.userStore.create({
      data: { tenantId: tenant.id, userId: user.id, storeId: store.id },
    });

    ctx = {
      tenantId: tenant.id,
      userId: user.id,
      storeId: store.id,
      role: "ADMIN",
      permissions: ["inventory.adjust", "inventory.transfer"],
    };

    const unit = await db.unitOfMeasure.create({
      data: { tenantId: tenant.id, code: "UN", name: "Unidade" },
      select: { id: true },
    });
    const product = await db.product.create({
      data: {
        tenantId: tenant.id,
        name: "Produto Concorrência",
        sku: "CONC-1",
        basePrice: "1.00",
        baseUnitId: unit.id,
      },
      select: { id: true },
    });
    productId = product.id;
    await db.productStore.create({
      data: { tenantId: tenant.id, storeId: store.id, productId: product.id },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("100 entradas concorrentes preservam o saldo total (sem perda de atualização)", async () => {
    const svc = new StockService(db);
    await Promise.all(
      Array.from({ length: 100 }, () =>
        svc.stockIn(ctx, ctx.storeId!, { productId, quantity: "1" }),
      ),
    );
    const bal = await svc.balance(ctx, ctx.storeId!, productId);
    expect(bal.quantity.toString()).toBe("100");
  });

  it("saídas concorrentes nunca levam saldo a negativo (guarda atômica)", async () => {
    const svc = new StockService(db);
    const results = await Promise.allSettled(
      Array.from({ length: 200 }, () =>
        svc.stockOut(ctx, ctx.storeId!, { productId, quantity: "1" }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(ok).toBe(100);
    expect(rejected).toBe(100);

    const bal = await svc.balance(ctx, ctx.storeId!, productId);
    expect(bal.quantity.toString()).toBe("0");
  });

  it("estoque insuficiente → 409 STOCK_INSUFFICIENT (nunca negativo silencioso)", async () => {
    const svc = new StockService(db);
    const bal = await svc.balance(ctx, ctx.storeId!, productId);
    expect(bal.quantity.toString()).toBe("0");
    await expect(
      svc.stockOut(ctx, ctx.storeId!, { productId, quantity: "1" }),
    ).rejects.toMatchObject({ status: 409, code: "STOCK_INSUFFICIENT" });
  });

  it("version incrementa a cada atualização e optimistic conflict detecta concorrência", async () => {
    const svc = new StockService(db);
    let bal = await svc.balance(ctx, ctx.storeId!, productId);
    const v0 = bal.version;

    await svc.stockIn(ctx, ctx.storeId!, { productId, quantity: "10" });
    bal = await svc.balance(ctx, ctx.storeId!, productId);
    expect(bal.version).toBe(v0 + 1);

    await svc.stockOut(ctx, ctx.storeId!, { productId, quantity: "3" });
    bal = await svc.balance(ctx, ctx.storeId!, productId);
    expect(bal.version).toBe(v0 + 2);

    const row = await db.stockBalance.findUnique({
      where: {
        tenantId_storeId_productId: {
          tenantId: ctx.tenantId,
          storeId: ctx.storeId!,
          productId,
        },
      },
    });
    expect(row?.version).toBe(v0 + 2);

    const repo = new StockBalanceRepository(db, ctx);
    const stale = await repo.applyDelta(db, {
      storeId: ctx.storeId!,
      productId,
      delta: new Prisma.Decimal("-1"),
      expectedVersion: v0,
    });
    expect(stale.status).toBe("VERSION_CONFLICT");
  });

  it("histórico registra balanceAfter coeso após operações sequenciais", async () => {
    const svc = new StockService(db);
    const movements = await svc.history(ctx, ctx.storeId!, { productId, limit: 1000 });
    expect(movements.length).toBeGreaterThan(0);

    const byType = movements.reduce<Record<string, number>>((acc, m) => {
      acc[m.type] = (acc[m.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType.IN).toBe(101);
    expect(byType.OUT).toBe(101);

    const first = movements[movements.length - 1];
    expect(first.balanceAfter.toString()).toBe("1");
  });
});