// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { PurchaseService } from "@/modules/purchases/services/purchase-service";
import { SupplierService } from "@/modules/purchases/services/supplier-service";

const TRUNCATE_TABLES = [
  "AuditLog",
  "StockBalance",
  "StockMovement",
  "PurchaseItem",
  "Purchase",
  "Supplier",
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

describe("Compras — fornecedores/pedidos/entrada/estoque (F9)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let tenantBId: string;
  let storeA1Id: string;
  let storeA2Id: string;
  let storeB1Id: string;

  let ctxA: TenantContext;
  let ctxB: TenantContext;

  let productAId: string;
  let productA2Id: string;
  let productBId: string;
  let unitUnId: string;

  let supplierSvcA: SupplierService;
  let purchaseSvcA: PurchaseService;
  let supplierSvcB: SupplierService;
  let purchaseSvcB: PurchaseService;

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
      "purchases.manage",
      "products.create",
      "unityMeasure.manage",
      "unitConversion.manage",
      "inventory.adjust",
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

    supplierSvcA = new SupplierService(db);
    purchaseSvcA = new PurchaseService(db);
    supplierSvcB = new SupplierService(db);
    purchaseSvcB = new PurchaseService(db);

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

    const productA2 = await db.product.create({
      data: {
        tenantId: tenantAId,
        name: "Refrigerante 2L",
        sku: "COCA-002",
        basePrice: "8.00",
        baseUnitId: unit.id,
        categoryId: category.id,
      },
      select: { id: true },
    });
    productA2Id = productA2.id;
    await db.productStore.create({
      data: { tenantId: tenantAId, storeId: storeA1Id, productId: productA2Id },
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

  async function createSupplierA(name: string, extra: Record<string, string> = {}) {
    const s = await db.supplier.create({
      data: { tenantId: tenantAId, name, ...extra },
      select: { id: true },
    });
    return s.id;
  }

  it("cria, atualiza e desativa fornecedor; valida duplicidade de documento e audita", async () => {
    const created = await supplierSvcA.create(ctxA, {
      name: "Atacadão Central",
      document: "12345678000195",
      email: "vendas@atacadao.com",
    });
    expect(created.name).toBe("Atacadão Central");
    expect(created.document).toBe("12345678000195");
    expect(created.email).toBe("vendas@atacadao.com");

    await expect(
      supplierSvcA.create(ctxA, { name: "Duplicado", document: "12345678000195" }),
    ).rejects.toMatchObject({ status: 409, code: "SUPPLIER_DOCUMENT_TAKEN" });

    const updated = await supplierSvcA.update(ctxA, created.id, { city: "São Paulo" });
    expect(updated.city).toBe("São Paulo");
    expect(updated.status).toBe("ACTIVE");

    const deactivated = await supplierSvcA.deactivate(ctxA, created.id);
    expect(deactivated.status).toBe("INACTIVE");

    await expect(
      supplierSvcA.get(ctxA, "inexistente"),
    ).rejects.toMatchObject({ status: 404, code: "SUPPLIER_NOT_FOUND" });

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "SUPPLIER_CREATED" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "SUPPLIER_UPDATED" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "SUPPLIER_DEACTIVATED" } }),
    ).toBe(1);
  });

  it("cria pedido de compra calcula total e audita PURCHASE_CREATED", async () => {
    const supplierId = await createSupplierA("Fornecedor A");

    const purchase = await purchaseSvcA.create(ctxA, {
      storeId: storeA1Id,
      supplierId,
      notes: "Compra inicial",
      expectedAt: new Date("2026-10-05"),
      items: [
        { productId: productAId, quantity: "2", unitCost: "10.50" },
        { productId: productA2Id, quantity: "3", unitCost: "4.00" },
      ],
    });

    expect(purchase).toBeTruthy();
    const check = await purchaseSvcA.get(ctxA, purchase.id);
    expect(check.status).toBe("ORDERED");
    expect(check.totalAmount.toString()).toBe("33");

    const rows = await db.purchaseItem.findMany({ where: { purchaseId: purchase.id } });
    expect(rows).toHaveLength(2);
    const first = rows.find((r) => r.productId === productAId);
    expect(first?.totalCost.toString()).toBe("21");
    expect(first?.unitCost.toString()).toBe("10.5");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PURCHASE_CREATED" } }),
    ).toBe(1);
  });

  it("cria pedido sem store no ctx/storeId → 400 STORE_REQUIRED", async () => {
    const partialCtx = { ...ctxA, storeId: null };
    await expect(
      purchaseSvcA.create(partialCtx, { items: [{ productId: productAId, quantity: "1", unitCost: "1" }] }),
    ).rejects.toMatchObject({ status: 400, code: "STORE_REQUIRED" });
  });

  it("pedido com store de outro tenant → 400 INVALID_STORE; fornecedor inválido → 400 INVALID_SUPPLIER", async () => {
    await expect(
      purchaseSvcA.create(ctxA, {
        storeId: storeB1Id,
        items: [{ productId: productAId, quantity: "1", unitCost: "1" }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_STORE" });

    await expect(
      purchaseSvcA.create(ctxA, {
        storeId: storeA1Id,
        supplierId: "inexistente",
        items: [{ productId: productAId, quantity: "1", unitCost: "1" }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_SUPPLIER" });

    await expect(
      purchaseSvcA.create(ctxA, {
        storeId: storeA1Id,
        items: [{ productId: "produto-inexistente", quantity: "1", unitCost: "1" }],
      }),
    ).rejects.toMatchObject({ status: 404, code: "PRODUCT_NOT_FOUND" });
  });

  it("edita pedido ORDERED (substitui itens e recalcula total) e audita PURCHASE_UPDATED", async () => {
    const supplierId = await createSupplierA("Fornecedor Editar");
    const purchase = await purchaseSvcA.create(ctxA, {
      storeId: storeA1Id,
      supplierId,
      items: [{ productId: productAId, quantity: "1", unitCost: "2" }],
    });

    const updated = await purchaseSvcA.update(ctxA, purchase.id, {
      notes: "Editada",
      items: [{ productId: productAId, quantity: "5", unitCost: "3" }],
    });
    expect(updated.status).toBe("ORDERED");
    expect(updated.totalAmount.toString()).toBe("15");
    expect(updated.notes).toBe("Editada");

    const itemRows = await db.purchaseItem.findMany({ where: { purchaseId: purchase.id } });
    expect(itemRows).toHaveLength(1);
    expect(itemRows[0].quantity.toString()).toBe("5");
    expect(itemRows[0].totalCost.toString()).toBe("15");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PURCHASE_UPDATED" } }),
    ).toBe(1);
  });

  it("pedido recebido não pode editar/cancelar → 409; cancela pedido ORDERED e audita", async () => {
    const supplierId = await createSupplierA("Fornecedor X");
    const p1 = await purchaseSvcA.create(ctxA, {
      storeId: storeA1Id,
      supplierId,
      items: [{ productId: productAId, quantity: "1", unitCost: "5" }],
    });
    const received = await purchaseSvcA.receive(ctxA, p1.id, {});
    expect(received.status).toBe("RECEIVED");

    await expect(
      purchaseSvcA.update(ctxA, p1.id, { notes: "não pode" }),
    ).rejects.toMatchObject({ status: 409, code: "PURCHASE_NOT_EDITABLE" });
    await expect(purchaseSvcA.cancel(ctxA, p1.id)).rejects.toMatchObject({
      status: 409,
      code: "PURCHASE_NOT_CANCELLABLE",
    });

    const p2 = await purchaseSvcA.create(ctxA, {
      storeId: storeA1Id,
      items: [{ productId: productAId, quantity: "1", unitCost: "2" }],
    });
    const cancelled = await purchaseSvcA.cancel(ctxA, p2.id);
    expect(cancelled.status).toBe("CANCELLED");

    await expect(purchaseSvcA.cancel(ctxA, p2.id)).rejects.toMatchObject({
      status: 409,
      code: "PURCHASE_NOT_CANCELLABLE",
    });

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PURCHASE_CANCELLED" } }),
    ).toBe(1);
  });

  it("entrada aplica estoque (IN com PURCHASE), grava lote/validade e audita PURCHASE_RECEIVED", async () => {
    const supplierId = await createSupplierA("Fornecedor Entrada");
    const purchase = await purchaseSvcA.create(ctxA, {
      storeId: storeA1Id,
      supplierId,
      items: [{ productId: productAId, quantity: "10", unitCost: "1", batchNumber: "LOTE-ORIG" }],
    });

    const stockBefore = await db.stockBalance.findUnique({
      where: {
        tenantId_storeId_productId: {
          tenantId: tenantAId,
          storeId: storeA1Id,
          productId: productAId,
        },
      },
    });
    const beforeQty = stockBefore ? stockBefore.quantity.toString() : "0";

    const received = await purchaseSvcA.receive(ctxA, purchase.id, {
      items: [{ productId: productAId, batchNumber: "LOTE-ENTRADA", expiryDate: new Date("2028-03-01") }],
    });
    expect(received.status).toBe("RECEIVED");
    expect(received.receivedAt).toBeInstanceOf(Date);

    const item = await db.purchaseItem.findFirst({ where: { purchaseId: purchase.id } });
    expect(item?.batchNumber).toBe("LOTE-ENTRADA");
    expect(item?.expiryDate).toBeInstanceOf(Date);

    const bal = await db.stockBalance.findUnique({
      where: {
        tenantId_storeId_productId: {
          tenantId: tenantAId,
          storeId: storeA1Id,
          productId: productAId,
        },
      },
    });
    const expected = (Number(beforeQty) + 10).toString();
    expect(bal?.quantity.toString()).toBe(expected);

    const move = await db.stockMovement.findFirst({
      where: { referenceType: "PURCHASE", referenceId: purchase.id },
    });
    expect(move).toBeTruthy();
    expect(move?.type).toBe("IN");
    expect(move?.quantity.toString()).toBe("10");
    expect(move?.reason).toBe("Entrada por pedido de compra");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PURCHASE_RECEIVED" } }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("entrada em unidade com conversão soma na unidade base; re-receber → 409", async () => {
    const cx = await db.unitOfMeasure.create({
      data: { tenantId: tenantAId, code: "CX", name: "Caixa" },
      select: { id: true },
    });
    await db.unitConversion.create({
      data: { tenantId: tenantAId, fromUnitId: cx.id, toUnitId: unitUnId, factor: "12" },
    });

    const supplierId = await createSupplierA("Fornecedor CX");
    const purchase = await purchaseSvcA.create(ctxA, {
      storeId: storeA2Id,
      supplierId,
      items: [{ productId: productAId, quantity: "2", unitOfMeasureId: cx.id, unitCost: "24" }],
    });

    const received = await purchaseSvcA.receive(ctxA, purchase.id, {});
    expect(received.status).toBe("RECEIVED");

    const move = await db.stockMovement.findFirst({
      where: { referenceType: "PURCHASE", referenceId: purchase.id },
    });
    expect(move?.quantity.toString()).toBe("24");
    expect(move?.quantityInUnit?.toString()).toBe("2");

    await expect(purchaseSvcA.receive(ctxA, purchase.id, {})).rejects.toMatchObject({
      status: 409,
      code: "PURCHASE_NOT_RECEIVABLE",
    });
  });

  it("entrada com unidade sem conversão → 400 UNIT_CONVERSION_MISSING (rollback)", async () => {
    const kg = await db.unitOfMeasure.create({
      data: { tenantId: tenantAId, code: "KG", name: "Quilograma" },
      select: { id: true },
    });
    const supplierId = await createSupplierA("Fornecedor KG");
    const purchase = await purchaseSvcA.create(ctxA, {
      storeId: storeA1Id,
      supplierId,
      items: [{ productId: productAId, quantity: "1", unitOfMeasureId: kg.id, unitCost: "1" }],
    });

    await expect(purchaseSvcA.receive(ctxA, purchase.id, {})).rejects.toMatchObject({
      status: 400,
      code: "UNIT_CONVERSION_MISSING",
    });

    const stillOrdered = await db.purchase.findUnique({ where: { id: purchase.id } });
    expect(stillOrdered?.status).toBe("ORDERED");
    const moves = await db.stockMovement.count({ where: { referenceId: purchase.id } });
    expect(moves).toBe(0);
  });

  it("isolamento A×B: fornecedores e pedidos não vazam entre tenants", async () => {
    const supplierAId = await createSupplierA("Fornecedor Isolado", { document: "99999999000191" });

    await expect(
      supplierSvcB.get(ctxB, supplierAId),
    ).rejects.toMatchObject({ status: 404, code: "SUPPLIER_NOT_FOUND" });

    const sameDoc = await supplierSvcB.create(ctxB, { name: "Duplicado no B", document: "99999999000191" });
    expect(sameDoc.status).toBe("ACTIVE");

    const purchaseA = await purchaseSvcA.create(ctxA, {
      storeId: storeA1Id,
      supplierId: supplierAId,
      items: [{ productId: productAId, quantity: "1", unitCost: "1" }],
    });

    await expect(
      purchaseSvcB.get(ctxB, purchaseA.id),
    ).rejects.toMatchObject({ status: 404, code: "PURCHASE_NOT_FOUND" });

    const purchaseB = await purchaseSvcB.create(ctxB, {
      storeId: storeB1Id,
      supplierId: sameDoc.id,
      items: [{ productId: productBId, quantity: "2", unitCost: "1" }],
    });
    const bCheck = await purchaseSvcB.get(ctxB, purchaseB.id);
    expect(bCheck.totalAmount.toString()).toBe("2");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantBId, action: "PURCHASE_CREATED" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PURCHASE_CREATED" } }),
    ).toBeGreaterThanOrEqual(1);

    const listA = await purchaseSvcA.list(ctxA, {});
    expect(listA.map((p) => p.id)).toContain(purchaseA.id);
    expect(listA.map((p) => p.id)).not.toContain(purchaseB.id);
  });
});