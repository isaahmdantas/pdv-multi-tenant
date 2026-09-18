import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createCustomerCategorySchema,
  updateCustomerCategorySchema,
} from "@/modules/customers/schemas";
import { AUDIT_ACTIONS } from "@/modules/audit/types";

describe("Schemas F6 (clientes)", () => {
  it("createCustomerSchema normaliza documento (remove não-dígitos), exige 11 (CPF) ou 14 (CNPJ)", () => {
    const ok = createCustomerSchema.safeParse({ name: "Fulano", document: "123.456.789-09" });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.document).toBe("12345678909");

    const cnpj = createCustomerSchema.safeParse({ name: "Empresa", document: "12.345.678/0001-95" });
    expect(cnpj.success).toBe(true);
    if (!cnpj.success) return;
    expect(cnpj.data.document).toBe("12345678000195");

    expect(createCustomerSchema.safeParse({ name: "X", document: "123456789" }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: "X", document: "1234567890123" }).success).toBe(false);
  });

  it("createCustomerSchema: documento opcional, email validado/minúsculo, creditLimit default 0", () => {
    const semDoc = createCustomerSchema.safeParse({ name: "Fulano" });
    expect(semDoc.success).toBe(true);
    if (!semDoc.success) return;
    expect(semDoc.data.document).toBeUndefined();
    expect(semDoc.data.creditLimit).toBe("0");

    const email = createCustomerSchema.safeParse({ name: "X", email: " Fulano@Example.COM " });
    expect(email.success).toBe(true);
    if (!email.success) return;
    expect(email.data.email).toBe("fulano@example.com");

    expect(createCustomerSchema.safeParse({ name: "X", email: "invalido" }).success).toBe(false);
  });

  it("createCustomerSchema converte birthday com z.coerce.date e valida limite monetário", () => {
    const ok = createCustomerSchema.safeParse({ name: "X", birthday: "1990-01-02" });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.birthday).toBeInstanceOf(Date);

    expect(createCustomerSchema.safeParse({ name: "X", birthday: "não-data" }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: "X", creditLimit: "-5" }).success).toBe(false);
  });

  it("updateCustomerSchema aceita parcial (apenas name)", () => {
    const ok = updateCustomerSchema.safeParse({ name: "Novo" });
    expect(ok.success).toBe(true);
    expect(updateCustomerSchema.safeParse({}).success).toBe(true);
  });

  it("createCustomerCategorySchema exige nome e aplica isDefault default false", () => {
    const ok = createCustomerCategorySchema.safeParse({ name: "Varejo" });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.isDefault).toBe(false);

    expect(createCustomerCategorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(
      createCustomerCategorySchema.safeParse({ name: "Varejo", isDefault: true }).success,
    ).toBe(true);
  });

  it("updateCustomerCategorySchema é parcial", () => {
    expect(updateCustomerCategorySchema.safeParse({ isDefault: true }).success).toBe(true);
    expect(updateCustomerCategorySchema.safeParse({}).success).toBe(true);
  });

  it("AUDIT_ACTIONS contém as novas ações de F6", () => {
    const expected = [
      "CUSTOMER_CATEGORY_CREATED",
      "CUSTOMER_CATEGORY_UPDATED",
      "CUSTOMER_CATEGORY_DEACTIVATED",
      "CUSTOMER_CREATED",
      "CUSTOMER_UPDATED",
      "CUSTOMER_DEACTIVATED",
    ];
    for (const action of expected) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});