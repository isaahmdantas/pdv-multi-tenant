// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import { PricingService } from "@/modules/pricing/services/pricing-service";

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

const DAY = 24 * 60 * 60 * 1000;

describe("PricingService.resolve — motor de preços (F7)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let storeA1Id: string;
  let storeA2Id: string;
  let storeA3Id: string;
  let storeA4Id: string;
  let storeA5Id: string;
  let tenantBId: string;
  let storeB1Id: string;

  let catPadraoId: string;
  let catVarejoId: string;
  let catT2Id: string;
  let catT3Id: string;
  let catT5Id: string;
  let catT7vId: string;
  let catT7pId: string;
  let catT7cId: string;
  let catT9Id: string;
  let productAId: string;
  let productBId: string;

  beforeAll(async () => {
    db = createTestDb();
    await db.$executeRawUnsafe(
      `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
    );

    const tenantA = await db.tenant.create({ data: { name: "Tenant A", slug: "engine-a" } });
    const tenantB = await db.tenant.create({ data: { name: "Tenant B", slug: "engine-b" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const storeA1 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A1", code: "EA1" },
    });
    storeA1Id = storeA1.id;
    const storeB1 = await db.store.create({
      data: { tenantId: tenantBId, name: "Loja B1", code: "EB1" },
    });
    storeB1Id = storeB1.id;

    const makeCat = async (name: string) =>
      (await db.customerCategory.create({ data: { tenantId: tenantAId, name }, select: { id: true } })).id;
    catVarejoId = await makeCat("Varejo");
    catPadraoId = (
      await db.customerCategory.create({
        data: { tenantId: tenantAId, name: "Padrao", isDefault: true },
        select: { id: true },
      })
    ).id;
    catT2Id = await makeCat("UmA");
    catT3Id = await makeCat("UmB");
    catT5Id = await makeCat("Qtd");
    catT7vId = await makeCat("Vig");
    catT7pId = await makeCat("Pri");
    catT7cId = await makeCat("Cri");
    catT9Id = await makeCat("Hist");

    const storeA2 = await db.store.create({
      data: {
        tenantId: tenantAId,
        name: "Loja A2",
        code: "EA2",
        defaultCustomerCategoryId: catVarejoId,
      },
      select: { id: true },
    });
    storeA2Id = storeA2.id;

    const storeA3 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A3", code: "EA3" },
      select: { id: true },
    });
    storeA3Id = storeA3.id;

    const storeA4 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A4", code: "EA4" },
      select: { id: true },
    });
    storeA4Id = storeA4.id;

    const storeA5 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A5", code: "EA5" },
      select: { id: true },
    });
    storeA5Id = storeA5.id;

    const unit = await db.unitOfMeasure.create({
      data: { tenantId: tenantAId, code: "UN", name: "Unidade" },
      select: { id: true },
    });
    const pcat = await db.productCategory.create({
      data: { tenantId: tenantAId, name: "Bebidas" },
      select: { id: true },
    });
    const productA = await db.product.create({
      data: {
        tenantId: tenantAId,
        name: "Coca Lata",
        sku: "COCA-ENG",
        basePrice: "4.5",
        baseUnitId: unit.id,
        categoryId: pcat.id,
      },
      select: { id: true },
    });
    productAId = productA.id;
    const unitB = await db.unitOfMeasure.create({
      data: { tenantId: tenantBId, code: "UN", name: "Unidade" },
      select: { id: true },
    });
    const productB = await db.product.create({
      data: {
        tenantId: tenantBId,
        name: "Fanta",
        sku: "FANTA-ENG",
        basePrice: "3.5",
        baseUnitId: unitB.id,
      },
      select: { id: true },
    });
    productBId = productB.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function priceTable(data: Parameters<PrismaClient["priceTable"]["create"]>[0]["data"]) {
    const row = await db.priceTable.create({ data });
    return row.id;
  }

  async function priceRow(
    priceTableId: string,
    productId: string,
    data: { unitPrice: string; minimumQuantity?: string; maximumQuantity?: string },
  ) {
    return db.productPrice.create({
      data: {
        tenantId: tenantAId,
        priceTableId,
        productId,
        unitPrice: data.unitPrice,
        minimumQuantity: data.minimumQuantity ?? null,
        maximumQuantity: data.maximumQuantity ?? null,
      },
    });
  }

  const svc = () => new PricingService(db);

  it("1. promoção ativa vence qualquer tabela", async () => {
    const t = await priceTable({
      tenantId: tenantAId,
      name: "Promo-T1",
      storeId: storeA5Id,
      customerCategoryId: catVarejoId,
      defaultPrice: "7.00",
    });
    await priceRow(t, productAId, { unitPrice: "6.50" });
    const promo = await db.promotion.create({
      data: {
        tenantId: tenantAId,
        storeId: storeA5Id,
        productId: productAId,
        discountType: "PERCENTAGE",
        discountValue: "10",
      },
    });

    const res = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA5Id,
      productId: productAId,
      customerCategoryId: catVarejoId,
    });

    expect(res.appliedRule).toBe("PROMOTION");
    expect(res.promotionId).toBe(promo.id);
    expect(res.priceTableId).toBe(t);
    expect(res.unitPrice.toString()).toBe("5.85");
    expect(res.displayPrice.toString()).toBe("5.85");
  });

  it("2. tabela produto+unidade+categoria vence unidade+categoria", async () => {
    const tWithRow = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T2a",
      storeId: storeA1Id,
      customerCategoryId: catT2Id,
      defaultPrice: "7.50",
    });
    await priceRow(tWithRow, productAId, { unitPrice: "6.50" });
    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T2b",
      storeId: storeA1Id,
      customerCategoryId: catT2Id,
      defaultPrice: "7.00",
      priority: 50,
    });

    const res = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA1Id,
      productId: productAId,
      customerCategoryId: catT2Id,
    });

    expect(res.appliedRule).toBe("PRODUCT_CATEGORY_PRICE");
    expect(res.priceTableId).toBe(tWithRow);
    expect(res.unitPrice.toString()).toBe("6.5");
  });

  it("3. defaultPrice de unidade+categoria vence só-unidade e só-categoria", async () => {
    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T3a",
      storeId: storeA1Id,
      customerCategoryId: catT3Id,
      defaultPrice: "5.50",
      priority: 5,
    });
    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T3b",
      storeId: storeA1Id,
      defaultPrice: "5.00",
      priority: 20,
    });
    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T3c",
      customerCategoryId: catT3Id,
      defaultPrice: "5.00",
      priority: 20,
    });

    const res = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA1Id,
      productId: productAId,
      customerCategoryId: catT3Id,
    });

    expect(res.appliedRule).toBe("CATEGORY_DEFAULT_PRICE");
    expect(res.unitPrice.toString()).toBe("5.5");
  });

  it("4. categoria anônima: isDefault e store.defaultCustomerCategoryId", async () => {
    const tDefault = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T4a",
      customerCategoryId: catPadraoId,
      defaultPrice: "6.25",
    });

    const resAnon = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA3Id,
      productId: productAId,
    });
    expect(resAnon.appliedRule).toBe("CATEGORY_PRICE");
    expect(resAnon.priceTableId).toBe(tDefault);
    expect(resAnon.unitPrice.toString()).toBe("6.25");

    const tVarejo = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T4b",
      customerCategoryId: catVarejoId,
      defaultPrice: "7.75",
    });
    const resStore = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA2Id,
      productId: productAId,
    });
    expect(resStore.appliedRule).toBe("CATEGORY_PRICE");
    expect(resStore.priceTableId).toBe(tVarejo);
    expect(resStore.unitPrice.toString()).toBe("7.75");
  });

  it("5. faixas de quantidade 1–9 / 10–49 / 50+", async () => {
    const t = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T5",
      storeId: storeA1Id,
      customerCategoryId: catT5Id,
      defaultPrice: "8.00",
    });
    await priceRow(t, productAId, { unitPrice: "10.00", minimumQuantity: "1", maximumQuantity: "9" });
    await priceRow(t, productAId, { unitPrice: "9.00", minimumQuantity: "10", maximumQuantity: "49" });
    await priceRow(t, productAId, { unitPrice: "8.00", minimumQuantity: "50" });

    const req = {
      tenantId: tenantAId,
      storeId: storeA1Id,
      productId: productAId,
      customerCategoryId: catT5Id,
    };
    expect((await svc().resolve({ ...req, quantity: 5 })).unitPrice.toString()).toBe("10");
    expect((await svc().resolve({ ...req, quantity: 49 })).unitPrice.toString()).toBe("9");
    expect((await svc().resolve({ ...req, quantity: 50 })).unitPrice.toString()).toBe("8");
  });

  it("6. tabela expirada/futura/inativa é ignorada", async () => {
    const now = new Date();
    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T6exp",
      storeId: storeA4Id,
      defaultPrice: "1.00",
      validFrom: new Date(now.getTime() - 10 * DAY),
      validUntil: new Date(now.getTime() - 1 * DAY),
    });
    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T6fut",
      storeId: storeA4Id,
      defaultPrice: "2.00",
      validFrom: new Date(now.getTime() + 1 * DAY),
    });
    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T6off",
      storeId: storeA4Id,
      defaultPrice: "3.00",
      active: false,
    });
    const tGood = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T6ok",
      storeId: storeA4Id,
      defaultPrice: "9.00",
    });

    const res = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA4Id,
      productId: productAId,
    });

    expect(res.appliedRule).toBe("STORE_PRICE");
    expect(res.priceTableId).toBe(tGood);
    expect(res.unitPrice.toString()).toBe("9");
  });

  it("7. empate → priority → validFrom → createdAt", async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 5 * DAY);

    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T7va",
      customerCategoryId: catT7vId,
      defaultPrice: "10.00",
      priority: 5,
      validFrom: older,
    });
    const validFromNewer = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T7vb",
      customerCategoryId: catT7vId,
      defaultPrice: "10.50",
      priority: 5,
      validFrom: now,
    });

    const res1 = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA2Id,
      productId: productAId,
      customerCategoryId: catT7vId,
    });
    expect(res1.priceTableId).toBe(validFromNewer);
    expect(res1.unitPrice.toString()).toBe("10.5");

    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T7pa",
      customerCategoryId: catT7pId,
      defaultPrice: "11.00",
      priority: 5,
      validFrom: new Date(now.getTime() - DAY),
    });
    const high = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T7pb",
      customerCategoryId: catT7pId,
      defaultPrice: "11.50",
      priority: 50,
      validFrom: older,
    });
    const res2 = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA2Id,
      productId: productAId,
      customerCategoryId: catT7pId,
    });
    expect(res2.priceTableId).toBe(high);
    expect(res2.unitPrice.toString()).toBe("11.5");

    await priceTable({
      tenantId: tenantAId,
      name: "Eng-T7ca",
      customerCategoryId: catT7cId,
      defaultPrice: "12.00",
      priority: 5,
      validFrom: older,
    });
    const c2 = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T7cb",
      customerCategoryId: catT7cId,
      defaultPrice: "12.50",
      priority: 5,
      validFrom: older,
    });
    const res3 = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA2Id,
      productId: productAId,
      customerCategoryId: catT7cId,
    });
    expect(res3.priceTableId).toBe(c2);
    expect(res3.unitPrice.toString()).toBe("12.5");
  });

  it("8. sem tabela aplicável → product.basePrice", async () => {
    const res = await svc().resolve({
      tenantId: tenantBId,
      storeId: storeB1Id,
      productId: productBId,
    });

    expect(res.appliedRule).toBe("PRODUCT_BASE_PRICE");
    expect(res.priceTableId).toBeUndefined();
    expect(res.unitPrice.toString()).toBe("3.5");
  });

  it("9. resolução histórica é determinística por dateTime", async () => {
    const now = new Date();
    const tHist = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T9hist",
      storeId: storeA1Id,
      customerCategoryId: catT9Id,
      defaultPrice: "6.00",
      validFrom: new Date(now.getTime() - 30 * DAY),
      validUntil: new Date(now.getTime() - 1 * DAY),
    });
    const tNow = await priceTable({
      tenantId: tenantAId,
      name: "Eng-T9now",
      storeId: storeA1Id,
      customerCategoryId: catT9Id,
      defaultPrice: "9.50",
    });

    const past = new Date(now.getTime() - 10 * DAY);
    const resPast = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA1Id,
      productId: productAId,
      customerCategoryId: catT9Id,
      dateTime: past,
    });
    expect(resPast.priceTableId).toBe(tHist);
    expect(resPast.unitPrice.toString()).toBe("6");

    const resNow = await svc().resolve({
      tenantId: tenantAId,
      storeId: storeA1Id,
      productId: productAId,
      customerCategoryId: catT9Id,
    });
    expect(resNow.priceTableId).toBe(tNow);
    expect(resNow.unitPrice.toString()).toBe("9.5");
  });
});