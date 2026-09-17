// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import { TenantRepository } from "@/modules/tenant/repositories/tenant-repository";
import { UserRepository } from "@/modules/iam/repositories/user-repository";
import { AccessRepository } from "@/modules/iam/repositories/access-repository";
import { StoreSwitchService } from "@/modules/iam/services/store-switch-service";
import { AuthorizationService } from "@/modules/iam/services/authorization-service";
import { AuditLogRepository } from "@/modules/audit/repositories/audit-log-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

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

describe("Isolamento multi-tenant (A x B)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let tenantBId: string;
  let storeAId: string;
  let storeBId: string;
  let storeB2Id: string;
  let aliceId: string;
  let bobId: string;
  let aliceCtx: TenantContext;

  beforeAll(async () => {
    db = createTestDb();
    await db.$executeRawUnsafe(
      `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
    );

    const tenantA = await db.tenant.create({ data: { name: "Tenant A", slug: "tenant-a" } });
    const tenantB = await db.tenant.create({ data: { name: "Tenant B", slug: "tenant-b" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const storeA = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A1", code: "A1" },
    });
    const storeB = await db.store.create({
      data: { tenantId: tenantBId, name: "Loja B1", code: "B1" },
    });
    const storeB2 = await db.store.create({
      data: { tenantId: tenantBId, name: "Loja B2", code: "B2" },
    });
    storeAId = storeA.id;
    storeBId = storeB.id;
    storeB2Id = storeB2.id;

    const permSales = await db.permission.create({
      data: { tenantId: tenantAId, code: "sales.create" },
    });
    const roleAdminA = await db.role.create({
      data: { tenantId: tenantAId, name: "ADMIN", globalStoreAccess: true },
    });
    await db.rolePermission.create({
      data: { tenantId: tenantAId, roleId: roleAdminA.id, permissionId: permSales.id },
    });

    const roleOpB = await db.role.create({
      data: { tenantId: tenantBId, name: "OPERADOR", globalStoreAccess: false },
    });

    const alice = await db.user.create({
      data: {
        tenantId: tenantAId,
        name: "Alice",
        email: "alice@a.local",
        passwordHash: "x",
      },
    });
    const bob = await db.user.create({
      data: { tenantId: tenantBId, name: "Bob", email: "bob@b.local", passwordHash: "x" },
    });
    aliceId = alice.id;
    bobId = bob.id;

    await db.userRole.create({
      data: { tenantId: tenantAId, userId: aliceId, roleId: roleAdminA.id },
    });
    await db.userRole.create({
      data: { tenantId: tenantBId, userId: bobId, roleId: roleOpB.id },
    });
    await db.userStore.create({
      data: { tenantId: tenantBId, userId: bobId, storeId: storeBId },
    });

    aliceCtx = {
      tenantId: tenantAId,
      userId: aliceId,
      storeId: storeAId,
      role: "NONE",
      permissions: [],
    };
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("troca de unidade: A não vê a unidade de B (404, sem vazar existência)", async () => {
    const svc = new StoreSwitchService(db);
    await expect(svc.authorizeSwitch(tenantAId, aliceId, storeBId)).rejects.toMatchObject({
      status: 404,
      code: "STORE_NOT_FOUND",
    });
  });

  it("troca de unidade: B não vê a unidade de A (404)", async () => {
    const svc = new StoreSwitchService(db);
    await expect(svc.authorizeSwitch(tenantBId, bobId, storeAId)).rejects.toMatchObject({
      status: 404,
      code: "STORE_NOT_FOUND",
    });
  });

  it("troca de unidade: A acessa a própria unidade e ganha permissões", async () => {
    const svc = new StoreSwitchService(db);
    const result = await svc.authorizeSwitch(tenantAId, aliceId, storeAId);
    expect(result.storeId).toBe(storeAId);
    expect(result.permissions).toContain("sales.create");
  });

  it("troca de unidade: Bob sem globalStoreAccess não pode trocar para unidade sem UserStore", async () => {
    const svc = new StoreSwitchService(db);
    await expect(svc.authorizeSwitch(tenantBId, bobId, storeB2Id)).rejects.toMatchObject({
      status: 403,
      code: "STORE_NOT_ALLOWED",
    });
  });

  it("getUserByEmail: Alice não encontra usuário do tenant B", async () => {
    const repo = userRepo(db, { ...aliceCtx, storeId: null });
    const found = await repo.findByEmail("bob@b.local");
    expect(found).toBeNull();
  });

  it("getUserById: Alice não encontra Bob pelo id", async () => {
    const repo = userRepo(db, { ...aliceCtx, storeId: null });
    const found = await repo.findById(bobId);
    expect(found).toBeNull();
  });

  it("roles globais: Alice só enxerga roles do tenant A", async () => {
    const access = new AccessRepository(db, { ...aliceCtx, storeId: null });
    const roles = await access.userGlobalRoles();
    expect(roles.length).toBe(1);
    expect(roles[0].name).toBe("ADMIN");
    expect(roles[0].tenantId).toBe(tenantAId);
  });

  it("UserStore scoped: sem acesso a unidade de outro tenant", async () => {
    const access = new AccessRepository(db, { ...aliceCtx, storeId: null });
    const userStore = await access.findUserStore(storeBId);
    expect(userStore).toBeNull();
  });

  it("AuthorizationService.resolve resolve permissões com storeRole vencendo global", async () => {
    const svc = new AuthorizationService(db);
    const resolved = await svc.resolve(aliceCtx);
    expect(resolved.permissions).toContain("sales.create");
    expect(resolved.role).toBe("ADMIN");
  });

  it("Auditoria: log gravado fica no tenant de quem gerou e é invisível ao outro", async () => {
    await new AuditService(db).log({
      ctx: aliceCtx,
      action: "STORE_SWITCHED",
      entity: "Store",
      entityId: storeAId,
    });

    const aliceRepo = new AuditLogRepository(db, aliceCtx);
    const aliceLogs = await aliceRepo.tx.auditLog.count({
      where: { tenantId: tenantAId },
    });
    expect(aliceLogs).toBeGreaterThan(0);

    const bobCtx: TenantContext = {
      tenantId: tenantBId,
      userId: bobId,
      storeId: storeBId,
      role: "OPERADOR",
      permissions: [],
    };
    const bobRepo = new AuditLogRepository(db, bobCtx);
    const bobOwnLogs = await bobRepo.tx.auditLog.count({
      where: { tenantId: tenantBId },
    });
    expect(bobOwnLogs).toBe(0);
  });

  it("TenantRepository.isStoreOfTenant nega unidade de outro tenant", async () => {
    const repo = new TenantRepository(db, { ...aliceCtx, storeId: null });
    const isA = await repo.isStoreOfTenant(storeAId);
    const isB = await repo.isStoreOfTenant(storeBId);
    expect(isA).toBe(true);
    expect(isB).toBe(false);
  });
});

function userRepo(
  db: PrismaClient,
  context: TenantContext,
): UserRepository {
  return new UserRepository(db, context);
}