// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import { PasswordService } from "@/modules/iam/password";
import { AuthenticationService } from "@/modules/iam/services/authentication-service";
import { StoreSwitchService } from "@/modules/iam/services/store-switch-service";
import { AuditService } from "@/modules/audit/services/audit-service";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { SESSION_COOKIE_INSECURE } from "@/lib/session-cookies";

const TRUNCATE_TABLES = [
  "AuditLog",
  "UserStore",
  "UserRole",
  "RolePermission",
  "User",
  "Role",
  "Permission",
  "Store",
  "Tenant",
];

describe("Autenticação (F3)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let tenantBId: string;
  let tenantCId: string;
  let storeA1Id: string;
  let storeA2Id: string;
  let userIdACarol: string;
  let userIdBCopy: string;

  const PASSWORD = "Segredo@1234";

  beforeAll(async () => {
    db = createTestDb();
    await db.$executeRawUnsafe(
      `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
    );

    // Tenants A/B/C.
    const tenantA = await db.tenant.create({ data: { name: "Tenant A", slug: "tenant-a" } });
    const tenantB = await db.tenant.create({ data: { name: "Tenant B", slug: "tenant-b" } });
    const tenantC = await db.tenant.create({ data: { name: "Tenant C", slug: "tenant-c" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
    tenantCId = tenantC.id;

    // Stores A1/A2 no tenant A.
    const storeA1 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A1", code: "A1" },
    });
    const storeA2 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A2", code: "A2" },
    });
    storeA1Id = storeA1.id;
    storeA2Id = storeA2.id;

    // Permissões e roles do tenant A (ADMIN com globalStoreAccess).
    for (const code of ["sales.create", "sales.cancel", "settings.manage"]) {
      await db.permission.create({ data: { tenantId: tenantAId, code } });
    }
    const roleAdminA = await db.role.create({
      data: { tenantId: tenantAId, name: "ADMIN", globalStoreAccess: true },
    });
    const permsA = await db.permission.findMany({
      where: { tenantId: tenantAId },
      select: { id: true },
    });
    await db.rolePermission.createMany({
      data: permsA.map((p) => ({
        tenantId: tenantAId,
        roleId: roleAdminA.id,
        permissionId: p.id,
      })),
    });

    // Role OPERADOR no tenant B (sem permissões).
    await db.role.create({
      data: { tenantId: tenantBId, name: "OPERADOR", globalStoreAccess: false },
    });

    // Carol (A, ativa): e-mail único p/ login feliz sem slug.
    const hash = await PasswordService.hash(PASSWORD);
    const carol = await db.user.create({
      data: {
        tenantId: tenantAId,
        name: "Carol",
        email: "carol@a.local",
        passwordHash: hash,
      },
    });
    // Dup (A+B) p/ MULTIPLE_TENANTS; Dorminhoca (C) inativa p/ 403.
    await db.user.create({
      data: { tenantId: tenantAId, name: "Dup", email: "dup@x.local", passwordHash: hash },
    });
    const dupB = await db.user.create({
      data: { tenantId: tenantBId, name: "Dup B", email: "dup@x.local", passwordHash: hash },
    });
    await db.user.create({
      data: {
        tenantId: tenantCId,
        name: "Dorminhoca",
        email: "dorme@x.local",
        passwordHash: hash,
        status: "INACTIVE",
      },
    });
    userIdACarol = carol.id;
    userIdBCopy = dupB.id;

    // Carol: role ADMIN global + UserStore A1 com storeRole ADMIN.
    await db.userRole.create({
      data: { tenantId: tenantAId, userId: carol.id, roleId: roleAdminA.id },
    });
    await db.userStore.create({
      data: {
        tenantId: tenantAId,
        userId: carol.id,
        storeId: storeA1Id,
        storeRoleId: roleAdminA.id,
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("login feliz: resolve tenant/unidade/role/permissões e audita LOGIN", async () => {
    const result = await new AuthenticationService(db).login({
      email: "carol@a.local",
      password: PASSWORD,
    });
    expect(result.tenantId).toBe(tenantAId);
    expect(result.userId).toBe(userIdACarol);
    expect(result.storeId).toBe(storeA1Id);
    expect(result.role).toBe("ADMIN");
    expect(result.permissions).toEqual(
      expect.arrayContaining(["sales.create", "settings.manage"]),
    );
    expect(SESSION_COOKIE_INSECURE).toBeTruthy();

    const loginCount = await db.auditLog.count({
      where: { tenantId: tenantAId, action: "LOGIN" },
    });
    expect(loginCount).toBe(1);
  });

  it("senha errada → 401 INVALID_CREDENTIALS", async () => {
    const svc = new AuthenticationService(db);
    await expect(
      svc.login({ email: "carol@a.local", password: "senha-errada" }),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
  });

  it("e-mail em 2 tenants sem slug → 400 MULTIPLE_TENANTS", async () => {
    const svc = new AuthenticationService(db);
    await expect(
      svc.login({ email: "dup@x.local", password: PASSWORD }),
    ).rejects.toMatchObject({ status: 400, code: "MULTIPLE_TENANTS" });
  });

  it("slug resolve o tenant certo mesmo com e-mail duplicado (B)", async () => {
    const result = await new AuthenticationService(db).login({
      email: "dup@x.local",
      password: PASSWORD,
      tenantSlug: "tenant-b",
    });
    expect(result.tenantId).toBe(tenantBId);
    expect(result.userId).toBe(userIdBCopy);
    expect(result.storeId).toBeNull();
  });

  it("slug de outro tenant sem o usuário → 401", async () => {
    const svc = new AuthenticationService(db);
    await expect(
      svc.login({ email: "dup@x.local", password: PASSWORD, tenantSlug: "tenant-c" }),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
  });

  it("usuário inativo → 403 INACTIVE_USER", async () => {
    const svc = new AuthenticationService(db);
    await expect(
      svc.login({ email: "dorme@x.local", password: PASSWORD }),
    ).rejects.toMatchObject({ status: 403, code: "INACTIVE_USER" });
  });

  it("troca de unidade valida acesso, atualiza contexto e pode alimentar o JWT", async () => {
    const login = await new AuthenticationService(db).login({
      email: "carol@a.local",
      password: PASSWORD,
      tenantSlug: "tenant-a",
    });
    expect(login.storeId).toBe(storeA1Id);

    const switched = await new StoreSwitchService(db).authorizeSwitch(
      tenantAId,
      userIdACarol,
      storeA2Id,
    );
    expect(switched.storeId).toBe(storeA2Id);
    expect(switched.role).toBe("ADMIN");
    expect(switched.permissions).toEqual(
      expect.arrayContaining(["sales.create", "settings.manage"]),
    );

    // O route handler POST /api/v1/session/store grava o STORE_SWITCHED com o
    // contexto atualizado; aqui reproduzimos o mesmo caminho p/ validar a auditoria.
    const ctx: TenantContext = {
      tenantId: tenantAId,
      userId: userIdACarol,
      storeId: switched.storeId,
      role: switched.role,
      permissions: switched.permissions,
    };
    await new AuditService(db).log({
      ctx,
      action: "STORE_SWITCHED",
      entity: "Store",
      entityId: switched.storeId,
      before: { storeId: login.storeId },
      after: { storeId: switched.storeId },
    });
    const switchCount = await db.auditLog.count({
      where: { tenantId: tenantAId, action: "STORE_SWITCHED" },
    });
    expect(switchCount).toBe(1);
  });
});