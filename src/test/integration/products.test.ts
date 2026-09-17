// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { ProductService } from "@/modules/products/services/product-service";
import { ProductCategoryService } from "@/modules/products/services/product-category-service";
import { ProductBrandService } from "@/modules/products/services/product-brand-service";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";

const TRUNCATE_TABLES = [
  "AuditLog",
  "ProductStore",
  "ProductBarcode",
  "Product",
  "UnitConversion",
  "UnitOfMeasure",
  "ProductBrand",
  "ProductCategory",
  "UserStore",
  "UserRole",
  "RolePermission",
  "User",
  "Role",
  "Permission",
  "Store",
  "Tenant",
];

describe("Produtos (F5)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let tenantBId: string;
  let storeA1Id: string;
  let adminAId: string;

  let ctxA: TenantContext;
  let ctxB: TenantContext;

  let unitUnId: string;
  let unitCxId: string;
  let unitBId: string;
  let catId: string;
  let brandId: string;

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
    storeA1Id = storeA1.id;

    for (const code of ["products.create", "products.update", "products.delete", "settings.manage"]) {
      await db.permission.create({ data: { tenantId: tenantAId, code } });
      await db.permission.create({ data: { tenantId: tenantBId, code } });
    }

    const roleAdminA = await db.role.create({
      data: { tenantId: tenantAId, name: "ADMIN", globalStoreAccess: true },
    });
    const roleAdminB = await db.role.create({
      data: { tenantId: tenantBId, name: "ADMIN", globalStoreAccess: true },
    });
    const permsA = await db.permission.findMany({ where: { tenantId: tenantAId }, select: { id: true } });
    const permsB = await db.permission.findMany({ where: { tenantId: tenantBId }, select: { id: true } });
    await db.rolePermission.createMany({
      data: [
        ...permsA.map((p) => ({ tenantId: tenantAId, roleId: roleAdminA.id, permissionId: p.id })),
        ...permsB.map((p) => ({ tenantId: tenantBId, roleId: roleAdminB.id, permissionId: p.id })),
      ],
    });

    const adminA = await db.user.create({
      data: {
        tenantId: tenantAId,
        name: "Admin A",
        email: "admin@a.local",
        passwordHash: "hash",
      },
    });
    const adminB = await db.user.create({
      data: {
        tenantId: tenantBId,
        name: "Admin B",
        email: "admin@b.local",
        passwordHash: "hash",
      },
    });
    adminAId = adminA.id;
    await db.userRole.create({ data: { tenantId: tenantAId, userId: adminA.id, roleId: roleAdminA.id } });
    await db.userRole.create({ data: { tenantId: tenantBId, userId: adminB.id, roleId: roleAdminB.id } });
    await db.userStore.create({
      data: { tenantId: tenantAId, userId: adminA.id, storeId: storeA1Id },
    });

    const permCodes = ["products.create", "products.update", "products.delete", "settings.manage"];
    ctxA = {
      tenantId: tenantAId,
      userId: adminAId,
      storeId: storeA1Id,
      role: "ADMIN",
      permissions: permCodes,
    };
    ctxB = { tenantId: tenantBId, userId: adminB.id, storeId: null, role: "ADMIN", permissions: permCodes };
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("cria categoria, marca e unidades de medida com auditoria", async () => {
    catId = (await new ProductCategoryService(db).create(ctxA, { name: "Bebidas" })).id;
    brandId = (await new ProductBrandService(db).create(ctxA, { name: "Coca" })).id;

    unitUnId = (await new UnitMeasureService(db).create(ctxA, { code: "UN", name: "Unidade" })).id;
    unitCxId = (await new UnitMeasureService(db).create(ctxA, { code: "CX", name: "Caixa" })).id;

    // Unidade própria do tenant B (produto B referencia unidade do seu tenant).
    unitBId = (await new UnitMeasureService(db).create(ctxB, { code: "UN", name: "Unidade" })).id;

    const cats = await new ProductCategoryService(db).list(ctxA);
    expect(cats.map((c) => c.name)).toContain("Bebidas");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "UNIT_MEASURE_CREATED" } }),
    ).toBe(2);
  });

  it("cria produto com categoria/marca/unidade, código de barras e preço base Decimal", async () => {
    const svc = new ProductService(db);
    const created = await svc.create(ctxA, {
      name: "Refrigerante Lata",
      sku: "REF-001",
      description: "Lata 350ml",
      categoryId: catId,
      brandId,
      baseUnitId: unitUnId,
      basePrice: "12.34",
      barcodes: ["7891000101010"],
    });

    const product = await svc.get(ctxA, created.id);
    expect(product).toBeTruthy();
    if (!product) return;
    expect(product.basePrice.toString()).toBe("12.34");
    expect(product.category?.id).toBe(catId);
    expect(product.brand?.id).toBe(brandId);
    expect(product.barcodes.map((b) => b.value)).toEqual(["7891000101010"]);
    expect(product.availableInStore).toBe(true);
    expect(product.fiscal.isService).toBe(false);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRODUCT_CREATED" } }),
    ).toBe(1);
  });

  it("SKU duplicado → 409 PRODUCT_TAKEN", async () => {
    const svc = new ProductService(db);
    await expect(
      svc.create(ctxA, { name: "Outro", sku: "REF-001", baseUnitId: unitUnId }),
    ).rejects.toMatchObject({ status: 409, code: "PRODUCT_TAKEN" });
  });

  it("código de barras já usado em outro produto → 409 BARCODE_TAKEN", async () => {
    const svc = new ProductService(db);
    await expect(
      svc.create(ctxA, {
        name: "Refri 2L",
        sku: "REF-002",
        baseUnitId: unitUnId,
        barcodes: ["7891000101010"],
      }),
    ).rejects.toMatchObject({ status: 409, code: "BARCODE_TAKEN" });
  });

  it("produto criado no tenant B não é visível no tenant A (list/get/barcode)", async () => {
    const svcB = new ProductService(db);
    const bProduct = await svcB.create(ctxB, {
      name: "Produto secreto B",
      sku: "SECRET-B",
      baseUnitId: unitBId,
      barcodes: ["9990000000001"],
    });

    const svcA = new ProductService(db);
    const listA = await svcA.list(ctxA);
    expect(listA.map((p) => p.id)).not.toContain(bProduct.id);

    await expect(svcA.get(ctxA, bProduct.id)).rejects.toMatchObject({
      status: 404,
      code: "PRODUCT_NOT_FOUND",
    });

    await expect(svcA.findByBarcode(ctxA, "9990000000001")).rejects.toMatchObject({
      status: 404,
      code: "PRODUCT_NOT_FOUND",
    });

    const found = await svcB.findByBarcode(ctxB, "9990000000001");
    expect(found?.sku).toBe("SECRET-B");
  });

  it("update altera campos, substitui códigos de barras e audita PRODUCT_UPDATED", async () => {
    const svc = new ProductService(db);
    const product = (await svc.list(ctxA)).find((p) => p.sku === "REF-001");
    expect(product).toBeTruthy();
    if (!product) return;

    await svc.update(ctxA, product.id, {
      name: "Refrigerante Lata 350ml",
      basePrice: "13.90",
      barcodes: ["7891000101011"],
    });

    const updated = await svc.get(ctxA, product.id);
    expect(updated).toBeTruthy();
    if (!updated) return;
    expect(updated.name).toBe("Refrigerante Lata 350ml");
    expect(updated.basePrice.toString()).toBe("13.9");
    expect(updated.barcodes.map((b) => b.value)).toEqual(["7891000101011"]);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRODUCT_UPDATED" } }),
    ).toBe(1);
  });

  it("soft delete sai da listagem e audita PRODUCT_DEACTIVATED", async () => {
    const svc = new ProductService(db);
    const product = (await svc.list(ctxA)).find((p) => p.sku === "REF-001");
    expect(product).toBeTruthy();
    if (!product) return;

    await svc.deactivate(ctxA, product.id);

    const list = await svc.list(ctxA);
    expect(list.map((p) => p.id)).not.toContain(product.id);

    const row = await db.product.findUnique({ where: { id: product.id } });
    expect(row?.status).toBe("INACTIVE");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRODUCT_DEACTIVATED" } }),
    ).toBe(1);
  });

  it("setStoreStatus INACTIVE reflete availableInStore=false e audita PRODUCT_STORE_UPDATED", async () => {
    const svc = new ProductService(db);
    const product = await svc.create(ctxA, {
      name: "Salgadinho",
      sku: "SAL-001",
      baseUnitId: unitUnId,
    });

    const link = await svc.setStoreStatus(ctxA, product.id, storeA1Id, "INACTIVE");
    expect(link.status).toBe("INACTIVE");

    const listed = (await svc.list(ctxA)).find((p) => p.id === product.id);
    expect(listed?.availableInStore).toBe(false);

    await svc.setStoreStatus(ctxA, product.id, storeA1Id, "ACTIVE");
    const after = (await svc.get(ctxA, product.id));
    expect(after).toBeTruthy();
    if (!after) return;
    expect(after.availableInStore).toBe(true);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "PRODUCT_STORE_UPDATED" } }),
    ).toBe(2);
  });

  it("conversões: cria CX→UN, duplica → 409, self → 400, destino inválido → 400, remove + auditorias", async () => {
    const svc = new UnitMeasureService(db);

    await svc.addConversion(ctxA, unitCxId, { toUnitId: unitUnId, factor: "12" });
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "UNIT_CONVERSION_CREATED" } }),
    ).toBe(1);

    const list = await svc.list(ctxA);
    const cx = list.find((u) => u.id === unitCxId);
    expect(cx?.conversions.map((c) => ({ to: c.toUnit.code, f: c.factor.toString() }))).toEqual([
      { to: "UN", f: "12" },
    ]);

    await expect(svc.addConversion(ctxA, unitCxId, { toUnitId: unitUnId, factor: "10" })).rejects.toMatchObject(
      { status: 409, code: "UNIT_CONVERSION_EXISTS" },
    );
    await expect(svc.addConversion(ctxA, unitCxId, { toUnitId: unitCxId, factor: "1" })).rejects.toMatchObject(
      { status: 400, code: "INVALID_CONVERSION" },
    );
    await expect(svc.addConversion(ctxA, unitCxId, { toUnitId: "nao-existe", factor: "2" })).rejects.toMatchObject(
      { status: 400, code: "INVALID_TARGET_UNIT" },
    );

    await svc.removeConversion(ctxA, unitCxId, unitUnId);
    const after = await svc.list(ctxA);
    expect(after.find((u) => u.id === unitCxId)?.conversions).toHaveLength(0);
    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "UNIT_CONVERSION_DELETED" } }),
    ).toBe(1);
  });
});