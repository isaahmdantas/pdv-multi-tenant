import { describe, it, expect } from "vitest";
import {
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseSchema,
  updatePurchaseSchema,
  receivePurchaseSchema,
} from "@/modules/purchases/schemas";
import { AUDIT_ACTIONS } from "@/modules/audit/types";

describe("Schemas F9 (compras)", () => {
  it("createSupplierSchema exige name e normaliza document (remove não-dígitos)", () => {
    const ok = createSupplierSchema.safeParse({ name: "Atacadão", document: "12.345.678/0001-95" });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.document).toBe("12345678000195");

    expect(createSupplierSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createSupplierSchema.safeParse({ name: "X", document: "123456789" }).success).toBe(false);
    expect(createSupplierSchema.safeParse({ name: "X", document: "1234567890123" }).success).toBe(false);
  });

  it("createSupplierSchema valida email/minúsculo e state com 2 letras", () => {
    const email = createSupplierSchema.safeParse({ name: "X", email: " Forno@Example.COM " });
    expect(email.success).toBe(true);
    if (!email.success) return;
    expect(email.data.email).toBe("forno@example.com");

    expect(createSupplierSchema.safeParse({ name: "X", email: "invalido" }).success).toBe(false);
    expect(createSupplierSchema.safeParse({ name: "X", state: "sao paulo" }).success).toBe(false);
    const state = createSupplierSchema.safeParse({ name: "X", state: "sp" });
    expect(state.success).toBe(true);
    if (!state.success) return;
    expect(state.data.state).toBe("SP");
  });

  it("updateSupplierSchema aceita parcial", () => {
    expect(updateSupplierSchema.safeParse({ name: "Novo" }).success).toBe(true);
    expect(updateSupplierSchema.safeParse({}).success).toBe(true);
  });

  it("createPurchaseSchema exige ao menos um item e valida custo/quantidade", () => {
    const ok = createPurchaseSchema.safeParse({
      items: [{ productId: "p1", quantity: "2", unitCost: "10.50" }],
    });
    expect(ok.success).toBe(true);

    expect(createPurchaseSchema.safeParse({}).success).toBe(false);
    expect(createPurchaseSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      createPurchaseSchema.safeParse({ items: [{ productId: "p1", quantity: "-1", unitCost: "1" }] })
        .success,
    ).toBe(false);
    expect(
      createPurchaseSchema.safeParse({ items: [{ productId: "p1", quantity: "1", unitCost: "0" }] })
        .success,
    ).toBe(false);
  });

  it("createPurchaseSchema rejeita produto duplicado no mesmo pedido", () => {
    const dup = createPurchaseSchema.safeParse({
      items: [
        { productId: "p1", quantity: "1", unitCost: "1" },
        { productId: "p1", quantity: "2", unitCost: "1" },
      ],
    });
    expect(dup.success).toBe(false);
    if (dup.success) return;
    expect(dup.error.issues.find((i) => i.path.includes("items"))).toBeTruthy();
  });

  it("createPurchaseSchema aceita lote/validade convertendo datas", () => {
    const ok = createPurchaseSchema.safeParse({
      expectedAt: "2026-10-01",
      items: [
        {
          productId: "p1",
          quantity: "10",
          unitCost: "5",
          batchNumber: "LOTE-1",
          expiryDate: "2027-01-15",
        },
      ],
    });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.expectedAt).toBeInstanceOf(Date);
    expect(ok.data.items[0].expiryDate).toBeInstanceOf(Date);
    expect(ok.data.items[0].batchNumber).toBe("LOTE-1");
  });

  it("updatePurchaseSchema aceita headers sem items", () => {
    expect(updatePurchaseSchema.safeParse({ notes: "Só nota" }).success).toBe(true);
    expect(updatePurchaseSchema.safeParse({}).success).toBe(true);
  });

  it("receivePurchaseSchema aceita body vazio ou com overrides de lote/validade por produto", () => {
    expect(receivePurchaseSchema.safeParse({}).success).toBe(true);
    expect(receivePurchaseSchema.safeParse({ items: [] }).success).toBe(true);
    const ok = receivePurchaseSchema.safeParse({
      items: [{ productId: "p1", batchNumber: "L-9", expiryDate: "2028-01-01" }],
    });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.items?.[0].expiryDate).toBeInstanceOf(Date);
  });

  it("AUDIT_ACTIONS contém as novas ações de F9", () => {
    const expected = [
      "SUPPLIER_CREATED",
      "SUPPLIER_UPDATED",
      "SUPPLIER_DEACTIVATED",
      "PURCHASE_CREATED",
      "PURCHASE_UPDATED",
      "PURCHASE_CANCELLED",
      "PURCHASE_RECEIVED",
    ];
    for (const action of expected) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});