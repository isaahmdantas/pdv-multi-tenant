import { describe, it, expect } from "vitest";
import {
  createPriceTableSchema,
  updatePriceTableSchema,
  createProductPriceSchema,
  updateProductPriceSchema,
  createPromotionSchema,
  updatePromotionSchema,
} from "@/modules/pricing/schemas";
import { AUDIT_ACTIONS } from "@/modules/audit/types";
import { PRICE_PRIORITY } from "@/modules/pricing/constants";

describe("Schemas F7 (preços)", () => {
  it("createPriceTableSchema exige nome e aplica defaults (defaultPrice 0, priority 0, active true)", () => {
    const ok = createPriceTableSchema.safeParse({ name: "Tabela varejo" });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.defaultPrice).toBe("0");
    expect(ok.data.priority).toBe(0);
    expect(ok.data.active).toBe(true);

    expect(createPriceTableSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createPriceTableSchema.safeParse({}).success).toBe(false);
  });

  it("createPriceTableSchema: prioridade inteira 0–1000 e validUntil após validFrom", () => {
    expect(createPriceTableSchema.safeParse({ name: "T", priority: 1.5 }).success).toBe(false);
    expect(createPriceTableSchema.safeParse({ name: "T", priority: -1 }).success).toBe(false);
    expect(createPriceTableSchema.safeParse({ name: "T", priority: 1001 }).success).toBe(false);
    expect(createPriceTableSchema.safeParse({ name: "T", priority: 500 }).success).toBe(true);

    const ok = createPriceTableSchema.safeParse({
      name: "T",
      validFrom: "2026-01-01",
      validUntil: "2026-02-01",
    });
    expect(ok.success).toBe(true);

    const inv = createPriceTableSchema.safeParse({
      name: "T",
      validFrom: "2026-02-01",
      validUntil: "2026-01-01",
    });
    expect(inv.success).toBe(false);
  });

  it("updatePriceTableSchema é parcial", () => {
    expect(updatePriceTableSchema.safeParse({ active: false }).success).toBe(true);
    expect(updatePriceTableSchema.safeParse({}).success).toBe(true);
  });

  it("createProductPriceSchema exige priceTableId, productId e unitPrice > 0; faixa opcional", () => {
    expect(createProductPriceSchema.safeParse({ priceTableId: "t", productId: "p" }).success).toBe(false);
    expect(
      createProductPriceSchema.safeParse({ priceTableId: "t", productId: "p", unitPrice: "0" }).success,
    ).toBe(false);

    const ok = createProductPriceSchema.safeParse({
      priceTableId: "t",
      productId: "p",
      unitPrice: "12.50",
    });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.minimumQuantity).toBeUndefined();
    expect(ok.data.maximumQuantity).toBeUndefined();

    const faixa = createProductPriceSchema.safeParse({
      priceTableId: "t",
      productId: "p",
      unitPrice: "10",
      minimumQuantity: "10",
      maximumQuantity: "49",
    });
    expect(faixa.success).toBe(true);
  });

  it("createProductPriceSchema rejeita faixa invertida (min > max)", () => {
    expect(
      createProductPriceSchema.safeParse({
        priceTableId: "t",
        productId: "p",
        unitPrice: "10",
        minimumQuantity: "50",
        maximumQuantity: "9",
      }).success,
    ).toBe(false);
  });

  it("updateProductPriceSchema é parcial", () => {
    expect(updateProductPriceSchema.safeParse({ unitPrice: "8" }).success).toBe(true);
    expect(updateProductPriceSchema.safeParse({}).success).toBe(true);
  });

  it("createPromotionSchema: PERCENTAGE até 100, FIXED sem limite superior, validUntil após validFrom", () => {
    const ok = createPromotionSchema.safeParse({ discountType: "PERCENTAGE", discountValue: "10" });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.active).toBe(true);

    expect(
      createPromotionSchema.safeParse({ discountType: "PERCENTAGE", discountValue: "100" }).success,
    ).toBe(true);
    expect(
      createPromotionSchema.safeParse({ discountType: "PERCENTAGE", discountValue: "101" }).success,
    ).toBe(false);
    expect(
      createPromotionSchema.safeParse({ discountType: "FIXED", discountValue: "9999.99" }).success,
    ).toBe(true);
    expect(createPromotionSchema.safeParse({ discountType: "OUTRO", discountValue: "10" }).success).toBe(
      false,
    );

    const inv = createPromotionSchema.safeParse({
      discountType: "PERCENTAGE",
      discountValue: "10",
      validFrom: "2026-02-01",
      validUntil: "2026-01-01",
    });
    expect(inv.success).toBe(false);
  });

  it("updatePromotionSchema é parcial", () => {
    expect(updatePromotionSchema.safeParse({ active: false }).success).toBe(true);
    expect(updatePromotionSchema.safeParse({}).success).toBe(true);
  });

  it("PRICE_PRIORITY define a ordem única das 6 regras", () => {
    expect(PRICE_PRIORITY).toEqual({
      PROMOTION: 1,
      PRODUCT_CATEGORY_PRICE: 2,
      CATEGORY_DEFAULT_PRICE: 3,
      STORE_PRICE: 4,
      CATEGORY_PRICE: 5,
      PRODUCT_BASE_PRICE: 6,
    });
  });

  it("AUDIT_ACTIONS contém as novas ações de F7", () => {
    const expected = [
      "PRICE_TABLE_CREATED",
      "PRICE_TABLE_UPDATED",
      "PRICE_TABLE_DEACTIVATED",
      "PRODUCT_PRICE_CREATED",
      "PRODUCT_PRICE_UPDATED",
      "PRODUCT_PRICE_DELETED",
      "PROMOTION_CREATED",
      "PROMOTION_UPDATED",
      "PROMOTION_DEACTIVATED",
    ];
    for (const action of expected) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});