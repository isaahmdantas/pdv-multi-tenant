import { describe, it, expect } from "vitest";
import {
  stockInSchema,
  stockOutSchema,
  stockAdjustSchema,
  stockTransferSchema,
  minMaxSchema,
  openInventorySchema,
  closeInventorySchema,
} from "@/modules/inventory/schemas";
import { AUDIT_ACTIONS } from "@/modules/audit/types";
import { STOCK_MOVEMENT_TYPES } from "@/modules/inventory/constants";

describe("Schemas F8 (estoque)", () => {
  it("stockInSchema exige productId e quantity > 0; unitOfMeasureId e reason opcionais", () => {
    expect(stockInSchema.safeParse({ productId: "p" }).success).toBe(false);
    expect(stockInSchema.safeParse({ productId: "p", quantity: "0" }).success).toBe(false);
    expect(stockInSchema.safeParse({ productId: "p", quantity: -1 }).success).toBe(false);

    const ok = stockInSchema.safeParse({
      productId: "p",
      quantity: "2",
      unitOfMeasureId: "cx",
      reason: "Compra",
    });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.unitOfMeasureId).toBe("cx");
    expect(ok.data.reason).toBe("Compra");
  });

  it("stockOutSchema exige quantity > 0", () => {
    expect(stockOutSchema.safeParse({ productId: "p", quantity: "0" }).success).toBe(false);
    expect(stockOutSchema.safeParse({ productId: "p", quantity: "3" }).success).toBe(true);
  });

  it("stockAdjustSchema aceita delta positivo e negativo, rejeita zero e texto inválido", () => {
    expect(stockAdjustSchema.safeParse({ productId: "p", delta: "5" }).success).toBe(true);
    expect(stockAdjustSchema.safeParse({ productId: "p", delta: "-3.5" }).success).toBe(true);
    expect(stockAdjustSchema.safeParse({ productId: "p", delta: "0" }).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ productId: "p", delta: 0 }).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ productId: "p", delta: "abc" }).success).toBe(false);
  });

  it("stockTransferSchema exige destinationStoreId e ao menos 1 item; rejeita produto duplicado", () => {
    expect(stockTransferSchema.safeParse({ destinationStoreId: "d" }).success).toBe(false);
    expect(stockTransferSchema.safeParse({ destinationStoreId: "d", items: [] }).success).toBe(false);
    expect(stockTransferSchema.safeParse({ destinationStoreId: "d", items: [{ productId: "a", quantity: "1" }] }).success).toBe(true);

    const dup = stockTransferSchema.safeParse({
      destinationStoreId: "d",
      items: [
        { productId: "a", quantity: "1" },
        { productId: "a", quantity: "2" },
      ],
    });
    expect(dup.success).toBe(false);

    expect(
      stockTransferSchema.safeParse({
        destinationStoreId: "d",
        items: [{ productId: "a", quantity: "0" }],
      }).success,
    ).toBe(false);
  });

  it("minMaxSchema aplica defaults 0 e rejeita min > max", () => {
    const defaults = minMaxSchema.safeParse({ productId: "p" });
    expect(defaults.success).toBe(true);
    if (defaults.success) {
      expect(defaults.data.minStock).toBe("0");
      expect(defaults.data.maxStock).toBe("0");
    }
    const ok = minMaxSchema.safeParse({ productId: "p", minStock: "5", maxStock: "10" });
    expect(ok.success).toBe(true);
    expect(minMaxSchema.safeParse({ productId: "p", minStock: "10", maxStock: "5" }).success).toBe(false);
  });

  it("openInventorySchema só aceita notes opcional", () => {
    expect(openInventorySchema.safeParse({}).success).toBe(true);
    expect(openInventorySchema.safeParse({ notes: "Contagem geral" }).success).toBe(true);
    const long = openInventorySchema.safeParse({ notes: "x".repeat(2001) });
    expect(long.success).toBe(false);
  });

  it("closeInventorySchema exige itens com countedQuantity >= 0 e sem duplicatas", () => {
    expect(closeInventorySchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      closeInventorySchema.safeParse({ items: [{ productId: "a", countedQuantity: "10" }] }).success,
    ).toBe(true);
    expect(
      closeInventorySchema.safeParse({ items: [{ productId: "a", countedQuantity: "-1" }] }).success,
    ).toBe(false);
    const dup = closeInventorySchema.safeParse({
      items: [
        { productId: "a", countedQuantity: "10" },
        { productId: "a", countedQuantity: "12" },
      ],
    });
    expect(dup.success).toBe(false);
  });

  it("STOCK_MOVEMENT_TYPES define os 5 tipos de movimento", () => {
    expect(STOCK_MOVEMENT_TYPES).toEqual(["IN", "OUT", "ADJUST", "TRANSFER_IN", "TRANSFER_OUT"]);
  });

  it("AUDIT_ACTIONS contém as novas ações de F8", () => {
    const expected = [
      "STOCK_IN",
      "STOCK_OUT",
      "STOCK_ADJUSTED",
      "STOCK_MIN_MAX_UPDATED",
      "STOCK_TRANSFER",
      "INVENTORY_CREATED",
      "INVENTORY_CLOSED",
    ];
    for (const action of expected) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});