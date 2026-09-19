// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { PriceTableService } from "@/modules/pricing/services/price-table-service";
import { ProductPriceService } from "@/modules/pricing/services/product-price-service";
import { PromotionService } from "@/modules/pricing/services/promotion-service";

const TRUNCATE_TABLES = [
  "AuditLog",
  "ProductPrice",
  "PriceTable",
  "Promotion",
  "ProductStore",
  "ProductBarcode",
  "Product",
  "ProductCategory",
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

describe("Preços — CRUD scoped + auditoria (F7)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let tenantBId: string;
  let storeA1Id: string;
  let storeB1Id: string;

  let ctxA: TenantContext;
  let ctxB: TenantContext;

  let productAId: string;

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
    const storeB1 = await db.store.create({
      data: { tenantId: tenantBId, name: "Loja B1", code: "B1" },
    });
    storeA1Id = storeA1.id;
    storeB1Id = storeB1.id;

    for (const code of ["pricing.manage", "products.create", "customers.manage", "settings.manage"]) {
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

    const permCodes = ["pricing.manage", "products.create", "customers.manage", "settings.manage"];
    ctxA = {
      tenantId: tenantAId,
      userId: adminA.id,
      storeId: storeA1Id,
      role: "ADMIN",
      permissions: permCodes,
    };
    ctxB = {
      tenantId: tenantBId,
      userId: adminB.id,
      storeId: storeB1Id,
      role: "ADMIN",
      permissions: permCodes,
    };

    const unit = await db.unitOfMeasure.create({
      data: { tenantId: tenantAId, code: "UN", name: "Unidade" },
      select: { id: true },
    });
    const category = await db.productCategory.create({
      data: { tenantId: tenantAId, name: "Categoria Prod" },
      select: { id: true },
    });
    const product = await db.product.create({
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
    productAId = product.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("cria tabela de preço com defaultPrice/priority e audita PRICE_TABLE_CREATED", async () => {
    const svc = new PriceTableService(db);
    const created = await svc.create(ctxA, {
      name: "Tabela Varejo A1",
      storeId: storeA1Id,
      defaultPrice: "10.90",
      priority: 5,
    });
    expect(created.id).toBeTruthy();

    const table = await svc.get(ctxA, created.id);
    expect(table).toBeTruthy();
    if (!table) return;
    expect(table.name).toBe("Tabela Varejo A1");
    expect(table.store?.id).toBe(storeA1Id);
    expect(table.defaultPrice.toString()).toBe("10.9");
    expect(table.priority).toBe(5);
    expect(table.active).toBe(true);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRICE_TABLE_CREATED" } }),
    ).toBe(1);
  });

  it("nome duplicado → 409 PRICE_TABLE_TAKEN; refs inválidas → 400", async () => {
    const svc = new PriceTableService(db);
    await expect(svc.create(ctxA, { name: "Tabela Varejo A1" })).rejects.toMatchObject({
      status: 409,
      code: "PRICE_TABLE_TAKEN",
    });
    await expect(
      svc.create(ctxA, { name: "X", storeId: "nao-existe" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_STORE" });
    await expect(
      svc.create(ctxA, { name: "Y", customerCategoryId: "nao-existe" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CATEGORY" });
  });

  it("update e deactivate de tabela auditam PRICE_TABLE_UPDATED/DEACTIVATED", async () => {
    const svc = new PriceTableService(db);
    const list = await svc.list(ctxA);
    const table = list.find((t) => t.name === "Tabela Varejo A1");
    expect(table).toBeTruthy();
    if (!table) return;

    await svc.update(ctxA, table.id, { priority: 10, defaultPrice: "12.00" });
    const updated = await svc.get(ctxA, table.id);
    expect(updated?.priority).toBe(10);
    expect(updated?.defaultPrice.toString()).toBe("12");

    await expect(svc.update(ctxA, table.id, { storeId: "nao-existe" })).rejects.toMatchObject({
      status: 400,
    });

    await svc.deactivate(ctxA, table.id);
    const listActive = await svc.list(ctxA);
    expect(listActive.map((t) => t.id)).not.toContain(table.id);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRICE_TABLE_UPDATED" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRICE_TABLE_DEACTIVATED" } }),
    ).toBe(1);
  });

  it("cria preço de produto com faixa de quantidade e audita PRODUCT_PRICE_CREATED", async () => {
    const ptSvc = new PriceTableService(db);
    const table = await ptSvc.create(ctxA, {
      name: "Tabela Atacado A1",
      storeId: storeA1Id,
      defaultPrice: "8.00",
    });

    const svc = new ProductPriceService(db);
    const created = await svc.create(ctxA, {
      priceTableId: table.id,
      productId: productAId,
      unitPrice: "9.50",
      minimumQuantity: 10,
      maximumQuantity: 49,
    });
    expect(created.id).toBeTruthy();

    await svc.create(ctxA, {
      priceTableId: table.id,
      productId: productAId,
      unitPrice: "8.50",
      minimumQuantity: 50,
    });

    const rows = await svc.listByTable(ctxA, table.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.unitPrice.toString())).toEqual(["9.5", "8.5"]);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRODUCT_PRICE_CREATED" } }),
    ).toBe(2);
  });

  it("faixa sobreposta → 409 PRODUCT_PRICE_RANGE_CONFLICT; produto/tabela inválidos → 400", async () => {
    const tables = await new PriceTableService(db).list(ctxA);
    const atacado = tables.find((t) => t.name === "Tabela Atacado A1");
    expect(atacado).toBeTruthy();
    if (!atacado) return;

    const table = await new PriceTableService(db).create(ctxA, { name: "Tabela Comum A1", storeId: storeA1Id });

    const svc = new ProductPriceService(db);
    await expect(
      svc.create(ctxA, {
        priceTableId: atacado.id,
        productId: productAId,
        unitPrice: "7.00",
        minimumQuantity: 20,
      }),
    ).rejects.toMatchObject({ status: 409, code: "PRODUCT_PRICE_RANGE_CONFLICT" });

    await expect(
      svc.create(ctxA, { priceTableId: table.id, productId: "nao-existe", unitPrice: "7.00" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_PRODUCT" });

    await expect(
      svc.create(ctxA, { priceTableId: "nao-existe", productId: productAId, unitPrice: "7.00" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_PRICE_TABLE" });
  });

  it("update e remove de product price auditam UPDATED/DELETED e saem da lista", async () => {
    const rows = await new ProductPriceService(db).listByTable(ctxA, (await new PriceTableService(db).list(ctxA, { includeInactive: true })).find((t) => t.name === "Tabela Atacado A1")!.id);
    const target = rows.find((r) => r.unitPrice.toString() === "9.5");
    expect(target).toBeTruthy();
    if (!target) return;

    const svc = new ProductPriceService(db);
    await svc.update(ctxA, target.id, { unitPrice: "9.90" });
    await svc.remove(ctxA, target.id);

    const remaining = await svc.listByTable(ctxA, (await new PriceTableService(db).list(ctxA)).find((t) => t.name === "Tabela Atacado A1")!.id);
    expect(remaining.map((r) => r.id)).not.toContain(target.id);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRODUCT_PRICE_UPDATED" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRODUCT_PRICE_DELETED" } }),
    ).toBe(1);
  });

  it("cria promoção (PERCENTAGE e FIXED) e audita PROMOTION_CREATED", async () => {
    const svc = new PromotionService(db);
    const pct = await svc.create(ctxA, {
      storeId: storeA1Id,
      productId: productAId,
      discountType: "PERCENTAGE",
      discountValue: "10",
    });
    const fixed = await svc.create(ctxA, {
      discountType: "FIXED",
      discountValue: "2.50",
    });

    const promotions = await svc.list(ctxA);
    expect(promotions.map((p) => p.id)).toContain(pct.id);
    expect(promotions.map((p) => p.id)).toContain(fixed.id);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PROMOTION_CREATED" } }),
    ).toBe(2);
  });

  it("refs inválidas de promoção → 400; update/deactivate auditam", async () => {
    const svc = new PromotionService(db);
    await expect(
      svc.create(ctxA, { storeId: "nao-existe", discountType: "PERCENTAGE", discountValue: "5" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_STORE" });
    await expect(
      svc.create(ctxA, { productId: "nao-existe", discountType: "PERCENTAGE", discountValue: "5" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_PRODUCT" });

    const list = await svc.list(ctxA);
    const pct = list.find((p) => p.discountType === "PERCENTAGE");
    expect(pct).toBeTruthy();
    if (!pct) return;

    await svc.update(ctxA, pct.id, { discountValue: "15" });
    await svc.deactivate(ctxA, pct.id);

    const active = await svc.list(ctxA);
    expect(active.map((p) => p.id)).not.toContain(pct.id);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PROMOTION_UPDATED" } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PROMOTION_DEACTIVATED" } }),
    ).toBe(1);
  });

  it("isolamento A×B: tabelas/preços/promoções do tenant B invisíveis no A; get ≠ 404", async () => {
    const ptB = new PriceTableService(db);
    const tableB = await ptB.create(ctxB, { name: "Tabela B", storeId: storeB1Id, defaultPrice: "3.00" });

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
    await new ProductPriceService(db).create(ctxB, {
      priceTableId: tableB.id,
      productId: productB.id,
      unitPrice: "2.00",
    });
    await new PromotionService(db).create(ctxB, {
      discountType: "PERCENTAGE",
      discountValue: "50",
    });

    const ptA = new PriceTableService(db);
    const listA = await ptA.list(ctxA, { includeInactive: true });
    expect(listA.map((t) => t.id)).not.toContain(tableB.id);
    await expect(ptA.get(ctxA, tableB.id)).rejects.toMatchObject({
      status: 404,
      code: "PRICE_TABLE_NOT_FOUND",
    });

    const rowsB = await new ProductPriceService(db).listByTable(ctxB, tableB.id);
    expect(rowsB).toHaveLength(1);

    const promosA = await new PromotionService(db).list(ctxA, { includeInactive: true });
    expect(promosA.length).toBeGreaterThan(0);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PROMOTION_CREATED" } }),
    ).toBe(2);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantBId, action: "PROMOTION_CREATED" } }),
    ).toBe(1);
  });
});