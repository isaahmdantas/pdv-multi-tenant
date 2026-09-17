import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  createProductCategorySchema,
  createUnitMeasureSchema,
  createUnitConversionSchema,
  updateProductStoreSchema,
  moneySchema,
  positiveMoneySchema,
  toDecimal,
} from "@/modules/products/schemas";
import { AUDIT_ACTIONS } from "@/modules/audit/types";

describe("Schemas F5 (produtos)", () => {
  it("moneySchema aceita string decimal e número não negativo; rejeita texto/negativo", () => {
    expect(moneySchema.safeParse("12.34").success).toBe(true);
    expect(moneySchema.safeParse("0").success).toBe(true);
    expect(moneySchema.safeParse(12.34).success).toBe(true);
    expect(moneySchema.safeParse(0).success).toBe(true);
    expect(moneySchema.safeParse("abc").success).toBe(false);
    expect(moneySchema.safeParse("-1").success).toBe(false);
    expect(moneySchema.safeParse("1,5").success).toBe(false);
    expect(moneySchema.safeParse("12.34567").success).toBe(false);
  });

  it("positiveMoneySchema rejeita zero e negativo", () => {
    expect(positiveMoneySchema.safeParse("0").success).toBe(false);
    expect(positiveMoneySchema.safeParse(0).success).toBe(false);
    expect(positiveMoneySchema.safeParse(-2).success).toBe(false);
    expect(positiveMoneySchema.safeParse("2.5").success).toBe(true);
  });

  it("createProductSchema aplica defaults de basePrice e isService e limita barcodes", () => {
    const base = {
      name: "Refrigerante",
      sku: "REF-001",
      baseUnitId: "u1",
    };
    const ok = createProductSchema.safeParse(base);
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.basePrice).toBe("0");
    expect(ok.data.isService).toBe(false);

    const many = createProductSchema.safeParse({
      ...base,
      barcodes: Array.from({ length: 21 }, (_, i) => `9${i}`),
    });
    expect(many.success).toBe(false);

    const emptyBar = createProductSchema.safeParse({ ...base, barcodes: [" "] });
    expect(emptyBar.success).toBe(false);
  });

  it("createUnitMeasureSchema normaliza código para UPPER e valida tamanho", () => {
    const r = createUnitMeasureSchema.safeParse({ code: " cx ", name: "Caixa" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.code).toBe("CX");

    expect(createUnitMeasureSchema.safeParse({ code: "X".repeat(11), name: "n" }).success).toBe(
      false,
    );
    expect(createUnitMeasureSchema.safeParse({ code: "UN", name: "" }).success).toBe(false);
  });

  it("createProductCategorySchema exige nome não vazio", () => {
    expect(createProductCategorySchema.safeParse({ name: "Bebidas" }).success).toBe(true);
    expect(createProductCategorySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("createUnitConversionSchema exige toUnitId e fator positivo", () => {
    expect(createUnitConversionSchema.safeParse({}).success).toBe(false);
    expect(createUnitConversionSchema.safeParse({ toUnitId: "u2" }).success).toBe(false);
    expect(createUnitConversionSchema.safeParse({ toUnitId: "u2", factor: "12" }).success).toBe(
      true,
    );
  });

  it("updateProductStoreSchema aceita apenas ACTIVE/INACTIVE", () => {
    expect(updateProductStoreSchema.safeParse({ status: "INACTIVE" }).success).toBe(true);
    expect(updateProductStoreSchema.safeParse({ status: "PAUSED" }).success).toBe(false);
  });

  it("toDecimal converte string de dinheiro para Decimal do Prisma", () => {
    const d = toDecimal("12.34");
    expect(d.toString()).toBe("12.34");
    expect(typeof d).toBe("object");
  });

  it("AUDIT_ACTIONS contém as novas ações de F5", () => {
    const expected = [
      "PRODUCT_CATEGORY_CREATED",
      "PRODUCT_CATEGORY_UPDATED",
      "PRODUCT_CATEGORY_DEACTIVATED",
      "PRODUCT_BRAND_CREATED",
      "PRODUCT_BRAND_UPDATED",
      "PRODUCT_BRAND_DEACTIVATED",
      "UNIT_MEASURE_CREATED",
      "UNIT_MEASURE_UPDATED",
      "UNIT_MEASURE_DEACTIVATED",
      "UNIT_CONVERSION_CREATED",
      "UNIT_CONVERSION_DELETED",
      "PRODUCT_DEACTIVATED",
      "PRODUCT_STORE_UPDATED",
    ];
    for (const action of expected) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});