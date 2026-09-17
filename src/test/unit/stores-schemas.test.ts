import { describe, it, expect } from "vitest";
import {
  createStoreSchema,
  updateStoreSchema,
  createTerminalSchema,
} from "@/modules/stores/schemas";
import { grantUserStoreSchema, updateUserStoreSchema } from "@/modules/iam/schemas";
import { AUDIT_ACTIONS } from "@/modules/audit/types";

describe("Schemas F4 (unidades)", () => {
  it("createStoreSchema valida entrada mínima e aplica defaults", () => {
    const r = createStoreSchema.safeParse({ name: "Filial", code: "F1" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.timezone).toBe("America/Sao_Paulo");
    expect(r.data.fiscalEnabled).toBe(false);
  });

  it("createStoreSchema rejeita nome/código vazios e UF inválida", () => {
    expect(createStoreSchema.safeParse({ name: "", code: "F1" }).success).toBe(false);
    expect(createStoreSchema.safeParse({ name: "X", code: "" }).success).toBe(false);
    expect(createStoreSchema.safeParse({ name: "X", code: "F1", state: "SPP" }).success).toBe(
      false,
    );
  });

  it("updateStoreSchema aceita atualização parcial", () => {
    const r = updateStoreSchema.safeParse({ city: "Campinas" });
    expect(r.success).toBe(true);
  });

  it("createTerminalSchema valida modo em POS/SELF_CHECKOUT/ADMIN", () => {
    const ok = createTerminalSchema.safeParse({
      storeId: "s",
      name: "T",
      code: "PDV-1",
      mode: "SELF_CHECKOUT",
    });
    expect(ok.success).toBe(true);
    const bad = createTerminalSchema.safeParse({
      storeId: "s",
      name: "T",
      code: "PDV-2",
      mode: "TABLET",
    });
    expect(bad.success).toBe(false);
  });

  it("grantUserStoreSchema requer storeId e aceita storeRoleId nulo/ausente", () => {
    expect(grantUserStoreSchema.safeParse({}).success).toBe(false);
    expect(grantUserStoreSchema.safeParse({ storeId: "s" }).success).toBe(true);
    expect(grantUserStoreSchema.safeParse({ storeId: "s", storeRoleId: null }).success).toBe(
      true,
    );
  });

  it("updateUserStoreSchema aceita storeRoleId nulo", () => {
    expect(updateUserStoreSchema.safeParse({ storeRoleId: null }).success).toBe(true);
  });

  it("AUDIT_ACTIONS inclui ações de unidade e UserStore", () => {
    for (const action of [
      "STORE_CREATED",
      "STORE_UPDATED",
      "STORE_DEACTIVATED",
      "CASH_REGISTER_CREATED",
      "TERMINAL_DEACTIVATED",
      "USER_STORE_GRANTED",
      "USER_STORE_UPDATED",
      "USER_STORE_REVOKED",
    ]) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});