// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { StoreService } from "@/modules/stores/services/store-service";
import { CashRegisterService } from "@/modules/stores/services/cash-register-service";
import { TerminalService } from "@/modules/stores/services/terminal-service";
import { UserStoreService } from "@/modules/iam/services/user-store-service";
import { StoreSwitchService } from "@/modules/iam/services/store-switch-service";

const TRUNCATE_TABLES = [
  "AuditLog",
  "UserStore",
  "UserRole",
  "RolePermission",
  "CashRegister",
  "Terminal",
  "Device",
  "User",
  "Role",
  "Permission",
  "Store",
  "Tenant",
];

describe("Unidades da empresa (F4)", () => {
  let db: PrismaClient;
  let tenantAId: string;
  let tenantBId: string;
  let adminId: string;
  let opId: string;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  const auditCount = (ctx: TenantContext, action: string, entity?: string) => {
    return db.auditLog.count({ where: { tenantId: ctx.tenantId, action, entity } });
  };

  beforeAll(async () => {
    db = createTestDb();
    await db.$executeRawUnsafe(
      `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
    );

    const tenantA = await db.tenant.create({ data: { name: "Tenant A", slug: "tenant-a" } });
    const tenantB = await db.tenant.create({ data: { name: "Tenant B", slug: "tenant-b" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const admin = await db.user.create({
      data: {
        tenantId: tenantAId,
        name: "Admin A",
        email: "admin@a.local",
        passwordHash: "x",
      },
    });
    const op = await db.user.create({
      data: { tenantId: tenantAId, name: "Operador A", email: "op@a.local", passwordHash: "x" },
    });
    const bUser = await db.user.create({
      data: { tenantId: tenantBId, name: "User B", email: "userb@b.local", passwordHash: "x" },
    });
    adminId = admin.id;
    opId = op.id;

    ctxA = { tenantId: tenantAId, userId: adminId, storeId: null, role: "ADMIN", permissions: ["settings.manage"] };
    ctxB = { tenantId: tenantBId, userId: bUser.id, storeId: null, role: "NONE", permissions: [] };
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("cria unidade no tenant A e registra STORE_CREATED", async () => {
    const created = await new StoreService(db).create(ctxA, {
      name: "Matriz A",
      code: "MATRIZ-A",
      city: "São Paulo",
      state: "SP",
    });
    expect(created.name).toBe("Matriz A");
    expect(created.code).toBe("MATRIZ-A");
    expect(await auditCount(ctxA, "STORE_CREATED")).toBe(1);
  });

  it("bloqueia código duplicado no mesmo tenant (409)", async () => {
    await expect(
      new StoreService(db).create(ctxA, { name: "Outra", code: "MATRIZ-A" }),
    ).rejects.toMatchObject({ status: 409, code: "STORE_TAKEN" });
  });

  it("lista apenas unidades do próprio tenant (isolamento)", async () => {
    const vaiCriarEmB = new StoreService(db);
    await vaiCriarEmB.create(ctxB, { name: "Loja B", code: "LOJA-B" });

    const aStores = await new StoreService(db).list(ctxA);
    const bStores = await new StoreService(db).list(ctxB);
    expect(aStores.some((s) => s.code === "LOJA-B")).toBe(false);
    expect(bStores.some((s) => s.code === "LOJA-B")).toBe(true);
  });

  it("não encontra unidade de outro tenant via get (404)", async () => {
    await expect(new StoreService(db).get(ctxA, "inexistente")).rejects.toMatchObject({
      status: 404,
      code: "STORE_NOT_FOUND",
    });
  });

  it("atualiza unidade e registra STORE_UPDATED", async () => {
    const [store] = await new StoreService(db).list(ctxA);
    await new StoreService(db).update(ctxA, store.id, { city: "Campinas" });
    const after = await new StoreService(db).get(ctxA, store.id);
    expect(after.city).toBe("Campinas");
    expect(await auditCount(ctxA, "STORE_UPDATED")).toBe(1);
  });

  it("desativa unidade (soft) e ela sai de listAccessibleStores", async () => {
    const created = await new StoreService(db).create(ctxA, {
      name: "Filial X",
      code: "FILIAL-X",
    });
    await new StoreService(db).deactivate(ctxA, created.id);
    expect(await auditCount(ctxA, "STORE_DEACTIVATED")).toBe(1);

    const accessible = await new StoreSwitchService(db).listAccessibleStores(tenantAId, adminId);
    expect(accessible.some((s) => s.storeId === created.id)).toBe(false);
  });

  it("concede acesso de operador a unidade e authorizeSwitch passa a autorizar", async () => {
    const stores = await new StoreService(db).list(ctxA);
    const [target] = stores.filter((s) => s.code !== "FILIAL-X");

    await new UserStoreService(db).grant(ctxA, opId, { storeId: target.id });
    expect(await auditCount(ctxA, "USER_STORE_GRANTED")).toBe(1);

    const result = await new StoreSwitchService(db).authorizeSwitch(tenantAId, opId, target.id);
    expect(result.storeId).toBe(target.id);

    await new UserStoreService(db).revoke(ctxA, opId, target.id);
    expect(await auditCount(ctxA, "USER_STORE_REVOKED")).toBe(1);

    await expect(
      new StoreSwitchService(db).authorizeSwitch(tenantAId, opId, target.id),
    ).rejects.toMatchObject({ status: 403, code: "STORE_NOT_ALLOWED" });
  });

  it("registra caixas e terminais scoped por tenant", async () => {
    const [store] = await new StoreService(db).list(ctxA).then((s) => s);

    const reg = await new CashRegisterService(db).create(ctxA, { storeId: store.id, name: "Caixa 1" });
    expect(await auditCount(ctxA, "CASH_REGISTER_CREATED")).toBe(1);

    const term = await new TerminalService(db).create(ctxA, {
      storeId: store.id,
      name: "Terminal PDV",
      code: "PDV-01",
      mode: "POS",
    });
    expect(await auditCount(ctxA, "TERMINAL_CREATED")).toBe(1);

    const bRegisters = await new CashRegisterService(db).list(ctxB);
    expect(bRegisters.some((r) => r.id === reg.id)).toBe(false);

    const bTerminals = await new TerminalService(db).list(ctxB);
    expect(bTerminals.some((t) => t.id === term.id)).toBe(false);

    await new CashRegisterService(db).deactivate(ctxA, reg.id);
    await new TerminalService(db).deactivate(ctxA, term.id);
    expect(await auditCount(ctxA, "CASH_REGISTER_DEACTIVATED")).toBe(1);
    expect(await auditCount(ctxA, "TERMINAL_DEACTIVATED")).toBe(1);
  });
});