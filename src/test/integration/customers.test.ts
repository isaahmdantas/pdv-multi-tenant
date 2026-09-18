// @vitest-environment node
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { CustomerService } from "@/modules/customers/services/customer-service";
import { CustomerCategoryService } from "@/modules/customers/services/customer-category-service";

const TRUNCATE_TABLES = [
  "AuditLog",
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

describe("Clientes (F6)", () => {
  let db: PrismaClient;

  let tenantAId: string;
  let tenantBId: string;
  let storeA1Id: string;
  let adminAId: string;

  let ctxA: TenantContext;
  let ctxB: TenantContext;

  let categoryId: string;
  let categoryDefaultId: string;

  beforeAll(async () => {
    db = createTestDb();
    await db.$executeRawUnsafe(
      `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
    );

    const tenantA = await db.tenant.create({ data: { name: "Tenant A", slug: "tenant-a" } });
    const tenantB = await db.tenant.create({ data: { name: "Tenant B", slug: "tenant-b" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const storeA1 = await db.store.create({
      data: { tenantId: tenantAId, name: "Loja A1", code: "A1" },
    });
    storeA1Id = storeA1.id;

    for (const code of ["customers.manage", "settings.manage"]) {
      await db.permission.create({ data: { tenantId: tenantAId, code } });
      await db.permission.create({ data: { tenantId: tenantBId, code } });
    }

    const roleAdminA = await db.role.create({
      data: { tenantId: tenantAId, name: "ADMIN", globalStoreAccess: true },
    });
    const roleAdminB = await db.role.create({
      data: { tenantId: tenantBId, name: "ADMIN", globalStoreAccess: true },
    });
    const permsA = await db.permission.findMany({ where: { tenantId: tenantAId }, select: { id: true } });
    const permsB = await db.permission.findMany({ where: { tenantId: tenantBId }, select: { id: true } });
    await db.rolePermission.createMany({
      data: [
        ...permsA.map((p) => ({ tenantId: tenantAId, roleId: roleAdminA.id, permissionId: p.id })),
        ...permsB.map((p) => ({ tenantId: tenantBId, roleId: roleAdminB.id, permissionId: p.id })),
      ],
    });

    const adminA = await db.user.create({
      data: {
        tenantId: tenantAId,
        name: "Admin A",
        email: "admin@a.local",
        passwordHash: "hash",
      },
    });
    const adminB = await db.user.create({
      data: {
        tenantId: tenantBId,
        name: "Admin B",
        email: "admin@b.local",
        passwordHash: "hash",
      },
    });
    adminAId = adminA.id;
    await db.userRole.create({ data: { tenantId: tenantAId, userId: adminA.id, roleId: roleAdminA.id } });
    await db.userRole.create({ data: { tenantId: tenantBId, userId: adminB.id, roleId: roleAdminB.id } });
    await db.userStore.create({
      data: { tenantId: tenantAId, userId: adminA.id, storeId: storeA1Id },
    });

    const permCodes = ["customers.manage", "settings.manage"];
    ctxA = {
      tenantId: tenantAId,
      userId: adminAId,
      storeId: storeA1Id,
      role: "ADMIN",
      permissions: permCodes,
    };
    ctxB = { tenantId: tenantBId, userId: adminB.id, storeId: null, role: "ADMIN", permissions: permCodes };
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("cria categoria de cliente (padrão) com auditoria e lista ordenada", async () => {
    const svc = new CustomerCategoryService(db);
    categoryId = (await svc.create(ctxA, { name: "Varejo" })).id;

    categoryDefaultId = (
      await svc.create(ctxA, { name: "Atacado", isDefault: true })
    ).id;

    const categories = await svc.list(ctxA);
    expect(categories.map((c) => c.name)).toEqual(["Atacado", "Varejo"]);

    const rows = await db.customerCategory.findMany({ where: { tenantId: tenantAId } });
    const atacado = rows.find((c) => c.id === categoryDefaultId);
    const varejo = rows.find((c) => c.id === categoryId);
    expect(atacado?.isDefault).toBe(true);
    expect(varejo?.isDefault).toBe(false);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "CUSTOMER_CATEGORY_CREATED" } }),
    ).toBe(2);
  });

  it("categoria com nome duplicado → 409 CUSTOMER_CATEGORY_TAKEN", async () => {
    const svc = new CustomerCategoryService(db);
    await expect(svc.create(ctxA, { name: "Varejo" })).rejects.toMatchObject({
      status: 409,
      code: "CUSTOMER_CATEGORY_TAKEN",
    });
  });

  it("update de categoria: troca default e conflito de nome → 409; audita CUSTOMER_CATEGORY_UPDATED", async () => {
    const svc = new CustomerCategoryService(db);

    await svc.update(ctxA, categoryId, { isDefault: true });
    const rows = await db.customerCategory.findMany({ where: { tenantId: tenantAId } });
    const varejo = rows.find((c) => c.id === categoryId);
    const atacado = rows.find((c) => c.id === categoryDefaultId);
    expect(varejo?.isDefault).toBe(true);
    expect(atacado?.isDefault).toBe(false);

    await expect(svc.update(ctxA, categoryId, { name: "Atacado" })).rejects.toMatchObject({
      status: 409,
      code: "CUSTOMER_CATEGORY_TAKEN",
    });

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "CUSTOMER_CATEGORY_UPDATED" } }),
    ).toBe(1);
  });

  it("desativa categoria: sai da listagem, perde isDefault e audita", async () => {
    const svc = new CustomerCategoryService(db);
    await svc.deactivate(ctxA, categoryDefaultId);

    const list = await svc.list(ctxA);
    expect(list.map((c) => c.name)).toEqual(["Varejo"]);

    const row = await db.customerCategory.findUnique({ where: { id: categoryDefaultId } });
    expect(row?.status).toBe("INACTIVE");
    expect(row?.isDefault).toBe(false);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "CUSTOMER_CATEGORY_DEACTIVATED" } }),
    ).toBe(1);
  });

  it("cria cliente com categoria e creditLimit Decimal; audita CUSTOMER_CREATED", async () => {
    const svc = new CustomerService(db);
    const created = await svc.create(ctxA, {
      name: "Maria Silva",
      document: "12345678909",
      email: "maria@example.com",
      phone: "(11) 99999-0000",
      birthday: new Date("1990-05-10"),
      customerCategoryId: categoryId,
      creditLimit: "5000.00",
    });
    expect(created.id).toBeTruthy();
    expect(created.document).toBe("12345678909");

    const customer = await svc.get(ctxA, created.id);
    expect(customer).toBeTruthy();
    if (!customer) return;
    expect(customer.name).toBe("Maria Silva");
    expect(customer.email).toBe("maria@example.com");
    expect(customer.creditLimit.toString()).toBe("5000");
    expect(customer.category?.id).toBe(categoryId);
    expect(customer.category?.name).toBe("Varejo");
    expect(customer.status).toBe("ACTIVE");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "CUSTOMER_CREATED" } }),
    ).toBe(1);
  });

  it("documento duplicado → 409 CUSTOMER_DOCUMENT_TAKEN; e-mail duplicado → 409 CUSTOMER_EMAIL_TAKEN", async () => {
    const svc = new CustomerService(db);
    await expect(
      svc.create(ctxA, { name: "Outro", document: "12345678909" }),
    ).rejects.toMatchObject({ status: 409, code: "CUSTOMER_DOCUMENT_TAKEN" });

    await expect(
      svc.create(ctxA, { name: "Outro", email: "maria@example.com" }),
    ).rejects.toMatchObject({ status: 409, code: "CUSTOMER_EMAIL_TAKEN" });
  });

  it("categoria inválida (inexistente ou inativa) → 400 INVALID_CATEGORY", async () => {
    const svc = new CustomerService(db);
    await expect(
      svc.create(ctxA, { name: "X", customerCategoryId: "nao-existe" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CATEGORY" });

    await expect(
      svc.create(ctxA, { name: "Y", customerCategoryId: categoryDefaultId }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CATEGORY" });
  });

  it("cliente criado no tenant B não é visível no tenant A (list/get)", async () => {
    const svcB = new CustomerService(db);
    const bCustomer = await svcB.create(ctxB, {
      name: "Cliente secreto B",
      document: "529.982.247-25",
    });

    const svcA = new CustomerService(db);
    const listA = await svcA.list(ctxA);
    expect(listA.map((c) => c.id)).not.toContain(bCustomer.id);

    await expect(svcA.get(ctxA, bCustomer.id)).rejects.toMatchObject({
      status: 404,
      code: "CUSTOMER_NOT_FOUND",
    });
  });

  it("update altera campos, busca por termo e audita CUSTOMER_UPDATED", async () => {
    const svc = new CustomerService(db);
    const customer = (await svc.list(ctxA)).find((c) => c.name === "Maria Silva");
    expect(customer).toBeTruthy();
    if (!customer) return;

    await svc.update(ctxA, customer.id, {
      name: "Maria Souza",
      phone: null,
      creditLimit: "8000",
    });

    const updated = await svc.get(ctxA, customer.id);
    expect(updated).toBeTruthy();
    if (!updated) return;
    expect(updated.name).toBe("Maria Souza");
    expect(updated.phone).toBeNull();
    expect(updated.creditLimit.toString()).toBe("8000");

    const found = await svc.list(ctxA, { search: "maria souza" });
    expect(found.map((c) => c.id)).toContain(customer.id);

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "CUSTOMER_UPDATED" } }),
    ).toBe(1);
  });

  it("soft delete sai da listagem e audita CUSTOMER_DEACTIVATED", async () => {
    const svc = new CustomerService(db);
    const customer = (await svc.list(ctxA)).find((c) => c.name === "Maria Souza");
    expect(customer).toBeTruthy();
    if (!customer) return;

    await svc.deactivate(ctxA, customer.id);

    const list = await svc.list(ctxA);
    expect(list.map((c) => c.id)).not.toContain(customer.id);

    const row = await db.customer.findUnique({ where: { id: customer.id } });
    expect(row?.status).toBe("INACTIVE");

    expect(
      await db.auditLog.count({ where: { tenantId: tenantAId, action: "CUSTOMER_DEACTIVATED" } }),
    ).toBe(1);
  });
});