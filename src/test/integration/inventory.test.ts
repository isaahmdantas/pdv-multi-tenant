// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { StockService } from "@/modules/inventory/services/stock-service";
import { InventoryService } from "@/modules/inventory/services/inventory-service";

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

describe("Estoque — saldo/movimentos/transferências/inventário (F8)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let tenantBId: string;
  let storeA1Id: string;
  let storeA2Id: string;
  let storeB1Id: string;

  let ctxA: TenantContext;
  let ctxB: TenantContext;

  let productAId: string;
  let productBId: string;
  let unitUnId: string;

  beforeAll(async () => {
    db = createTestDb();
    await db.$executeRawUnsafe(
      `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
    );

    const tenantA = await db.tenant.create({ data: { name: "Tenant A", slug: "tenant-a" } });
    const tenantB = await db.tenant.create({ data: { name: "Tenant B", slug: "tenant-b" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const storeA1 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A1", code: "A1" },
    });
    const storeA2 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A2", code: "A2" },
    });
    const storeB1 = await db.store.create({
      data: { tenantId: tenantBId, name: "Loja B1", code: "B1" },
    });
    storeA1Id = storeA1.id;
    storeA2Id = storeA2.id;
    storeB1Id = storeB1.id;

    const perms = [
      "inventory.adjust",
      "inventory.transfer",
      "products.create",
      "unityMeasure.manage",
      "unitConversion.manage",
    ];
    for (const code of perms) {
      await db.permission.create({ data: { tenantId: tenantAId, code } });
      await db.permission.create({ data: { tenantId: tenantBId, code } });
    }

    const roleA = await db.role.create({
      data: { tenantId: tenantAId, name: "ADMIN", globalStoreAccess: true },
    });
    const roleB = await db.role.create({
      data: { tenantId: tenantBId, name: "ADMIN", globalStoreAccess: true },
    });
    const permsA = await db.permission.findMany({ where: { tenantId: tenantAId }, select: { id: true } });
    const permsB = await db.permission.findMany({ where: { tenantId: tenantBId }, select: { id: true } });
    await db.rolePermission.createMany({
      data: [
        ...permsA.map((p) => ({ tenantId: tenantAId, roleId: roleA.id, permissionId: p.id })),
        ...permsB.map((p) => ({ tenantId: tenantBId, roleId: roleB.id, permissionId: p.id })),
      ],
    });

    const adminA = await db.user.create({
      data: { tenantId: tenantAId, name: "Admin A", email: "admin@a.local", passwordHash: "hash" },
    });
    const adminB = await db.user.create({
      data: { tenantId: tenantBId, name: "Admin B", email: "admin@b.local", passwordHash: "hash" },
    });
    await db.userRole.create({ data: { tenantId: tenantAId, userId: adminA.id, roleId: roleA.id } });
    await db.userRole.create({ data: { tenantId: tenantBId, userId: adminB.id, roleId: roleB.id } });
    await db.userStore.create({
      data: { tenantId: tenantAId, userId: adminA.id, storeId: storeA1Id },
    });
    await db.userStore.create({
      data: { tenantId: tenantBId, userId: adminB.id, storeId: storeB1Id },
    });

    ctxA = {
      tenantId: tenantAId,
      userId: adminA.id,
      storeId: storeA1Id,
      role: "ADMIN",
      permissions: perms,
    };
    ctxB = {
      tenantId: tenantBId,
      userId: adminB.id,
      storeId: storeB1Id,
      role: "ADMIN",
      permissions: perms,
    };

    const unit = await db.unitOfMeasure.create({
      data: { tenantId: tenantAId, code: "UN", name: "Unidade" },
      select: { id: true },
    });
    unitUnId = unit.id;

    const category = await db.productCategory.create({
      data: { tenantId: tenantAId, name: "Categoria Prod" },
      select: { id: true },
    });
    const productA = await db.product.create({
      data: {
        tenantId: tenantAId,
        name: "Coca Lata",
        sku: "COCA-001",
        basePrice: "4.5",
        baseUnitId: unit.id,
        categoryId: category.id,
      },
      select: { id: true },
    });
    productAId = productA.id;
    await db.productStore.create({
      data: { tenantId: tenantAId, storeId: storeA1Id, productId: productAId },
    });
    await db.productStore.create({
      data: { tenantId: tenantAId, storeId: storeA2Id, productId: productAId },
    });

    const unitB = await db.unitOfMeasure.create({
      data: { tenantId: tenantBId, code: "UNB", name: "Unidade B" },
      select: { id: true },
    });
    const productB = await db.product.create({
      data: {
        tenantId: tenantBId,
        name: "Produto B",
        sku: "PROD-B",
        basePrice: "1.00",
        baseUnitId: unitB.id,
      },
      select: { id: true },
    });
    productBId = productB.id;
    await db.productStore.create({
      data: { tenantId: tenantBId, storeId: storeB1Id, productId: productBId },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("stockIn cria saldo e audita STOCK_IN; stockOut baixa e audita STOCK_OUT", async () => {
    const svc = new StockService(db);
    const after = await svc.stockIn(ctxA, storeA1Id, { productId: productAId, quantity: "100" });
    expect(after.toString()).toBe("100");

    const bal = await svc.balance(ctxA, storeA1Id, productAId);
    expect(bal.quantity.toString()).toBe("100");
    expect(bal.availableQuantity.toString()).toBe("100");
    expect(bal.reservedQuantity.toString()).toBe("0");
    expect(bal.version).toBe(1);

    const out = await svc.stockOut(ctxA, storeA1Id, { productId: productAId, quantity: "30" });
    expect(out.toString()).toBe("70");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "STOCK_IN" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "STOCK_OUT" } }),
    ).toBe(1);
  });

  it("stockOut sem saldo suficiente → 409 STOCK_INSUFFICIENT", async () => {
    const svc = new StockService(db);
    await expect(
      svc.stockOut(ctxA, storeA1Id, { productId: productAId, quantity: "500" }),
    ).rejects.toMatchObject({ status: 409, code: "STOCK_INSUFFICIENT" });
  });

  it("entrada em unidade diferente converte via UnitConversion (movimento registra unidade)", async () => {
    const cx = await db.unitOfMeasure.create({
      data: { tenantId: tenantAId, code: "CX", name: "Caixa" },
      select: { id: true },
    });
    await db.unitConversion.create({
      data: { tenantId: tenantAId, fromUnitId: cx.id, toUnitId: unitUnId, factor: "12" },
    });

    const svc = new StockService(db);
    await svc.stockIn(ctxA, storeA1Id, {
      productId: productAId,
      quantity: "2",
      unitOfMeasureId: cx.id,
      reason: "Compra 2 caixas",
    });

    const movements = await svc.history(ctxA, storeA1Id, { productId: productAId });
    const converted = movements.find((m) => m.unitOfMeasureId === cx.id);
    expect(converted).toBeTruthy();
    if (!converted) return;
    expect(converted.quantity.toString()).toBe("24");
    expect(converted.quantityInUnit?.toString()).toBe("2");
    expect(converted.type).toBe("IN");

    const bal = await svc.balance(ctxA, storeA1Id, productAId);
    expect(bal.quantity.toString()).toBe("94");
  });

  it("entrada em unidade sem conversão → 400 UNIT_CONVERSION_MISSING", async () => {
    const kg = await db.unitOfMeasure.create({
      data: { tenantId: tenantAId, code: "KG", name: "Quilograma" },
      select: { id: true },
    });
    const svc = new StockService(db);
    await expect(
      svc.stockIn(ctxA, storeA1Id, {
        productId: productAId,
        quantity: "1",
        unitOfMeasureId: kg.id,
      }),
    ).rejects.toMatchObject({ status: 400, code: "UNIT_CONVERSION_MISSING" });
  });

  it("adjust aplica delta assinado e audita STOCK_ADJUSTED", async () => {
    const svc = new StockService(db);
    await svc.adjust(ctxA, storeA1Id, { productId: productAId, delta: "6", reason: "Correção" });
    const bal = await svc.balance(ctxA, storeA1Id, productAId);
    expect(bal.quantity.toString()).toBe("100");

    await svc.adjust(ctxA, storeA1Id, { productId: productAId, delta: "-10" });
    expect((await svc.balance(ctxA, storeA1Id, productAId)).quantity.toString()).toBe("90");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "STOCK_ADJUSTED" } }),
    ).toBe(2);
  });

  it("setMinMax grava min/max no ProductStore e audita; level computa LOW/OK/HIGH", async () => {
    const svc = new StockService(db);
    await svc.setMinMax(ctxA, storeA1Id, { productId: productAId, minStock: "20", maxStock: "200" });

    const bal = await svc.balance(ctxA, storeA1Id, productAId);
    expect(bal.minStock.toString()).toBe("20");
    expect(bal.maxStock.toString()).toBe("200");
    expect(bal.level).toBe("OK");

    await svc.adjust(ctxA, storeA1Id, { productId: productAId, delta: "-80" });
    const below = await svc.balance(ctxA, storeA1Id, productAId);
    expect(below.level).toBe("LOW");

    const alerts = await svc.alerts(ctxA, storeA1Id);
    expect(alerts.map((a) => a.productId)).toContain(productAId);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "STOCK_MIN_MAX_UPDATED" } }),
    ).toBe(1);
  });

  it("transferência multiproduto movimenta origem/destino e audita STOCK_TRANSFER", async () => {
    const p2 = await db.product.create({
      data: {
        tenantId: tenantAId,
        name: "Produto 2",
        sku: "PROD-2",
        basePrice: "2.00",
        baseUnitId: unitUnId,
      },
      select: { id: true },
    });
    await db.productStore.create({
      data: { tenantId: tenantAId, storeId: storeA1Id, productId: p2.id },
    });
    await db.productStore.create({
      data: { tenantId: tenantAId, storeId: storeA2Id, productId: p2.id },
    });

    const svc = new StockService(db);
    await svc.stockIn(ctxA, storeA1Id, { productId: p2.id, quantity: "5" });
    await svc.stockIn(ctxA, storeA1Id, { productId: productAId, quantity: "10" });
    const srcBefore = await svc.balance(ctxA, storeA1Id, productAId);
    expect(srcBefore.quantity.toString()).toBe("20");

    const transfer = await svc.transfer(ctxA, storeA1Id, {
      destinationStoreId: storeA2Id,
      items: [
        { productId: productAId, quantity: "10" },
        { productId: p2.id, quantity: "5" },
      ],
      reason: "Abastecimento",
    });
    expect(transfer).toBeTruthy();

    const srcAfter = await svc.balance(ctxA, storeA1Id, productAId);
    expect(srcAfter.quantity.toString()).toBe("10");
    const destA = await svc.balance(ctxA, storeA2Id, productAId);
    expect(destA.quantity.toString()).toBe("10");
    const dest2 = await svc.balance(ctxA, storeA2Id, p2.id);
    expect(dest2.quantity.toString()).toBe("5");

    const rows = await db.stockTransfer.findFirst({ where: { id: transfer } });
    expect(rows?.status).toBe("COMPLETED");
    const items = await db.stockTransferItem.findMany({ where: { transferId: transfer } });
    expect(items).toHaveLength(2);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "STOCK_TRANSFER" } }),
    ).toBe(1);
  });

  it("transferência falha por item insuficiente → rollback total (origem intacta)", async () => {
    const p3 = await db.product.create({
      data: {
        tenantId: tenantAId,
        name: "Produto 3",
        sku: "PROD-3",
        basePrice: "3.00",
        baseUnitId: unitUnId,
      },
      select: { id: true },
    });
    await db.productStore.create({
      data: { tenantId: tenantAId, storeId: storeA1Id, productId: p3.id },
    });
    await db.productStore.create({
      data: { tenantId: tenantAId, storeId: storeA2Id, productId: p3.id },
    });

    const svc = new StockService(db);
    await svc.stockIn(ctxA, storeA1Id, { productId: p3.id, quantity: "2" });
    const before = await db.stockBalance.findUnique({
      where: {
        tenantId_storeId_productId: {
          tenantId: tenantAId,
          storeId: storeA1Id,
          productId: productAId,
        },
      },
    });

    await expect(
      svc.transfer(ctxA, storeA1Id, {
        destinationStoreId: storeA2Id,
        items: [
          { productId: p3.id, quantity: "2" },
          { productId: productAId, quantity: "99999" },
        ],
      }),
    ).rejects.toMatchObject({ status: 409, code: "STOCK_INSUFFICIENT" });

    const after = await db.stockBalance.findUnique({
      where: {
        tenantId_storeId_productId: {
          tenantId: tenantAId,
          storeId: storeA1Id,
          productId: productAId,
        },
      },
    });
    expect(after?.quantity.toString()).toBe(before?.quantity.toString());
    const p3after = await svc.balance(ctxA, storeA1Id, p3.id);
    expect(p3after.quantity.toString()).toBe("2");

    const destP3 = await svc.balance(ctxA, storeA2Id, p3.id);
    expect(destP3.quantity.toString()).toBe("0");
    const transferCount = await db.stockTransfer.count();
    expect(transferCount).toBe(1);
  });

  it("transferência origem == destino → 400 SAME_STORE_TRANSFER", async () => {
    const svc = new StockService(db);
    await expect(
      svc.transfer(ctxA, storeA1Id, {
        destinationStoreId: storeA1Id,
        items: [{ productId: productAId, quantity: "1" }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "SAME_STORE_TRANSFER" });
  });

  it("inventário: abre, conta, fecha; diferenças positiva/negativa/zero viram ADJUST", async () => {
    const svc = new StockService(db);
    const invSvc = new InventoryService(db);
    await svc.setMinMax(ctxA, storeA1Id, { productId: productAId, minStock: "0", maxStock: "0" });

    const balance = await svc.balance(ctxA, storeA1Id, productAId);
    expect(balance.quantity.toString()).toBe("10");
    expect(balance.level).toBe("OK");

    const opened = await invSvc.open(ctxA, storeA1Id, { notes: "Conferência" });
    expect(opened.status).toBe("OPEN");

    await expect(
      invSvc.open(ctxA, storeA1Id, { notes: "Segunda" }),
    ).rejects.toMatchObject({ status: 409, code: "INVENTORY_OPEN_EXISTS" });

    const item = opened.items.find((i) => i.productId === productAId);
    expect(item).toBeTruthy();
    if (!item) return;
    expect(item.expectedQuantity.toString()).toBe("10");

    const closed = await invSvc.close(ctxA, opened.id, {
      items: opened.items.map((i) => ({
        productId: i.productId,
        countedQuantity: i.productId === productAId ? "3" : i.expectedQuantity.toString(),
      })),
      notes: "Achados e perdidos",
    });
    expect(closed.status).toBe("CLOSED");

    const check = await db.inventoryItem.findUnique({
      where: {
        inventoryId_productId: { inventoryId: opened.id, productId: productAId },
      },
    });
    expect(check?.countedQuantity?.toString()).toBe("3");
    expect(check?.difference?.toString()).toBe("-7");

    expect((await svc.balance(ctxA, storeA1Id, productAId)).quantity.toString()).toBe("3");

    const moves = await svc.history(ctxA, storeA1Id, { productId: productAId });
    const adj = moves.find((m) => m.referenceType === "INVENTORY");
    expect(adj).toBeTruthy();
    if (!adj) return;
    expect(adj.type).toBe("ADJUST");
    expect(adj.quantity.toString()).toBe("7");
    expect(adj.referenceId).toBe(opened.id);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "INVENTORY_CREATED" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "INVENTORY_CLOSED" } }),
    ).toBe(1);
  });

  it("fechar inventário sem todos os itens conta → 400 INVENTORY_ITEMS_INCOMPLETE", async () => {
    const invSvc = new InventoryService(db);
    const opened = await invSvc.open(ctxA, storeA2Id, { notes: "Incompleto" });

    await expect(
      invSvc.close(ctxA, opened.id, { items: [] }),
    ).rejects.toMatchObject({ status: 400, code: "INVENTORY_ITEMS_INCOMPLETE" });

    await invSvc.close(ctxA, opened.id, {
      items: opened.items.map((i) => ({
        productId: i.productId,
        countedQuantity: i.expectedQuantity.toString(),
      })),
    });
  });

  it("inventário fechado não pode re-fechar → 409 INVENTORY_ALREADY_CLOSED", async () => {
    const invSvc = new InventoryService(db);
    const opened = await invSvc.open(ctxA, storeA2Id, { notes: "Duplo fecho" });
    await invSvc.close(ctxA, opened.id, {
      items: opened.items.map((i) => ({
        productId: i.productId,
        countedQuantity: i.expectedQuantity.toString(),
      })),
    });
    await expect(
      invSvc.close(ctxA, opened.id, {
        items: opened.items.map((i) => ({
          productId: i.productId,
          countedQuantity: "1",
        })),
      }),
    ).rejects.toMatchObject({ status: 409, code: "INVENTORY_ALREADY_CLOSED" });
  });

  it("isolamento A×B e store A×A2: tenantB e lojas diferentes não vazam saldo", async () => {
    const svc = new StockService(db);

    const balB = await svc.balance(ctxB, storeB1Id, productBId);
    expect(balB.quantity.toString()).toBe("0");

    await svc.stockIn(ctxB, storeB1Id, { productId: productBId, quantity: "7" });
    expect((await svc.balance(ctxB, storeB1Id, productBId)).quantity.toString()).toBe("7");

    const balA2 = await svc.balance(ctxA, storeA2Id, productAId);
    expect(balA2.quantity.toString()).toBe("10");

    const listA = await svc.listAll(ctxA, storeA1Id);
    expect(listA.map((r) => r.productId)).toContain(productAId);
    expect(listA.map((r) => r.productId)).not.toContain(productBId);

    const listB = await svc.listAll(ctxB, storeB1Id);
    expect(listB.map((r) => r.productId)).toContain(productBId);
    expect(listB.map((r) => r.productId)).not.toContain(productAId);

    const bMoves = await svc.history(ctxB, storeB1Id, { productId: productBId });
    expect(bMoves).toHaveLength(1);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantBId, action: "STOCK_IN" } }),
    ).toBe(1);
  });
});