// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDb } from "@/test/integration/db";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { SaleService } from "@/modules/sales/services/sale-service";
import { CashSessionService } from "@/modules/cash/services/cash-session-service";
import { CashRegisterService } from "@/modules/stores/services/cash-register-service";
import { StockBalanceRepository } from "@/modules/inventory/repositories/stock-balance-repository";
import { toDecimal } from "@/lib/money";

const TRUNCATE_TABLES = [
  "AuditLog",
  "SaleItem",
  "Sale",
  "StockBalance",
  "StockMovement",
  "CashMovement",
  "CashSession",
  "CashRegister",
  "Promotion",
  "PriceTable",
  "ProductStore",
  "ProductBarcode",
  "Product",
  "ProductCategory",
  "UnitOfMeasure",
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

const PERMS = [
  "sales.create",
  "sales.cancel",
  "sales.discount",
  "reports.view",
  "cash.open",
  "cash.close",
  "cash.supply",
  "cash.withdraw",
  "settings.manage",
  "products.create",
];

const db: PrismaClient = createTestDb();

const saleSvc = new SaleService(db);
const cashSessionSvc = new CashSessionService(db);
const cashRegisterSvc = new CashRegisterService(db);

let ctxA: TenantContext;
let ctxB: TenantContext;
let productAId = "";
let productBId = "";
let customerAId = "";
let regCounter = 0;

beforeAll(async () => {
  await db.$executeRawUnsafe(
    `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`,
  );

  const tenantA = await db.tenant.create({ data: { name: "Tenant A", slug: "tenant-a", status: "ACTIVE" } });
  const tenantB = await db.tenant.create({ data: { name: "Tenant B", slug: "tenant-b", status: "ACTIVE" } });

  for (const t of [tenantA, tenantB]) {
    for (const code of PERMS) {
      await db.permission.create({ data: { tenantId: t.id, code, description: code } });
    }
  }

  const roleA = await db.role.create({ data: { tenantId: tenantA.id, name: "ADMIN", description: "Admin A", globalStoreAccess: true } });
  const roleB = await db.role.create({ data: { tenantId: tenantB.id, name: "ADMIN", description: "Admin B", globalStoreAccess: true } });
  const permsA = await db.permission.findMany({ where: { tenantId: tenantA.id }, select: { id: true } });
  const permsB = await db.permission.findMany({ where: { tenantId: tenantB.id }, select: { id: true } });
  await db.rolePermission.createMany({
    data: [
      ...permsA.map((p) => ({ tenantId: tenantA.id, roleId: roleA.id, permissionId: p.id })),
      ...permsB.map((p) => ({ tenantId: tenantB.id, roleId: roleB.id, permissionId: p.id })),
    ],
  });

  const userA = await db.user.create({ data: { tenantId: tenantA.id, name: "Admin A", email: "admin-a@sale.test", passwordHash: "hash", status: "ACTIVE" } });
  const userB = await db.user.create({ data: { tenantId: tenantB.id, name: "Admin B", email: "admin-b@sale.test", passwordHash: "hash", status: "ACTIVE" } });
  await db.userRole.createMany({
    data: [
      { tenantId: tenantA.id, userId: userA.id, roleId: roleA.id },
      { tenantId: tenantB.id, userId: userB.id, roleId: roleB.id },
    ],
  });

  const storeA1 = await db.store.create({ data: { tenantId: tenantA.id, name: "Loja A1", code: "A1", status: "ACTIVE" } });
  const storeB1 = await db.store.create({ data: { tenantId: tenantB.id, name: "Loja B1", code: "B1", status: "ACTIVE" } });
  await db.userStore.createMany({
    data: [
      { tenantId: tenantA.id, userId: userA.id, storeId: storeA1.id },
      { tenantId: tenantB.id, userId: userB.id, storeId: storeB1.id },
    ],
  });

  ctxA = { tenantId: tenantA.id, userId: userA.id, storeId: storeA1.id, role: "ADMIN", permissions: [...PERMS] };
  ctxB = { tenantId: tenantB.id, userId: userB.id, storeId: storeB1.id, role: "ADMIN", permissions: [...PERMS] };

  const unitA = await db.unitOfMeasure.create({ data: { tenantId: tenantA.id, code: "UN", name: "Unidade" }, select: { id: true } });
  const unitB = await db.unitOfMeasure.create({ data: { tenantId: tenantB.id, code: "UNB", name: "Unidade B" }, select: { id: true } });

  const productA = await db.product.create({
    data: { tenantId: tenantA.id, name: "Coca Lata", sku: "COCA-001", basePrice: "4.5", baseUnitId: unitA.id },
    select: { id: true },
  });
  productAId = productA.id;
  await db.productStore.create({ data: { tenantId: tenantA.id, storeId: storeA1.id, productId: productAId, status: "ACTIVE" } });

  const productB = await db.product.create({
    data: { tenantId: tenantB.id, name: "Produto B", sku: "PROD-B", basePrice: "1.00", baseUnitId: unitB.id },
    select: { id: true },
  });
  productBId = productB.id;
  await db.productStore.create({ data: { tenantId: tenantB.id, storeId: storeB1.id, productId: productBId, status: "ACTIVE" } });

  const customerA = await db.customer.create({
    data: { tenantId: tenantA.id, name: "Cliente A", status: "ACTIVE" },
    select: { id: true },
  });
  customerAId = customerA.id;
});

afterAll(async () => {
  await db.$disconnect();
});

async function openSession(): Promise<{ id: string; cashRegisterId: string }> {
  regCounter += 1;
  const reg = await cashRegisterSvc.create(ctxA, { storeId: ctxA.storeId!, name: `Caixa S ${regCounter}` });
  const session = await cashSessionSvc.open(ctxA, { cashRegisterId: reg.id, openingAmount: "0" });
  return { id: session.id, cashRegisterId: reg.id };
}

async function openSessionB(): Promise<string> {
  regCounter += 1;
  const reg = await cashRegisterSvc.create(ctxB, { storeId: ctxB.storeId!, name: `Caixa SB ${regCounter}` });
  const session = await cashSessionSvc.open(ctxB, { cashRegisterId: reg.id, openingAmount: "0" });
  return session.id;
}

async function seedBalance(ctx: TenantContext, productId: string, amount: string | number) {
  await db.$transaction(async (tx) => {
    const result = await new StockBalanceRepository(db, ctx).applyDelta(tx, {
      storeId: ctx.storeId!,
      productId,
      delta: toDecimal(amount),
    });
    expect(result.status).toBe("OK");
  });
}

async function balanceOf(ctx: TenantContext, productId: string) {
  const row = await db.stockBalance.findFirst({
    where: { tenantId: ctx.tenantId, storeId: ctx.storeId!, productId },
  });
  return row ? Number(row.quantity) : 0;
}

describe("Sales F11 — checkout de PDV", () => {
  it("finaliza venda com preço base, baixa estoque, lança CashMovement SALE e audita", async () => {
    await seedBalance(ctxA, productAId, 100);
    const session = await openSession();

    const sale = await saleSvc.checkout(ctxA, {
      cashSessionId: session.id,
      payments: [{ methodCode: "CASH", amount: "9.00" }],
      items: [{ productId: productAId, quantity: "2" }],
    });

    expect(sale.status).toBe("COMPLETED");
    expect(Number(sale.subtotal)).toBe(9);
    expect(Number(sale.discount)).toBe(0);
    expect(Number(sale.total)).toBe(9);
    expect(sale.items).toHaveLength(1);
    expect(Number(sale.items[0].unitPrice)).toBe(4.5);
    expect(Number(sale.items[0].quantity)).toBe(2);
    expect(await balanceOf(ctxA, productAId)).toBe(98);

    const movements = await db.cashMovement.findMany({
      where: { tenantId: ctxA.tenantId, referenceId: sale.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe("SALE");
    expect(movements[0].methodCode).toBe("CASH");
    expect(Number(movements[0].amount)).toBe(9);
    expect(movements[0].cashSessionId).toBe(session.id);

    const stockOut = await db.stockMovement.findFirst({
      where: { tenantId: ctxA.tenantId, referenceType: "SALE", referenceId: sale.id, type: "OUT" },
    });
    expect(stockOut).toBeTruthy();
    expect(Number(stockOut?.quantity)).toBe(2);
    expect(Number(stockOut?.balanceAfter)).toBe(98);
  });

  it("aceita cliente válido na venda", async () => {
    const session = await openSession();
    const sale = await saleSvc.checkout(ctxA, {
      cashSessionId: session.id,
      customerId: customerAId,
      payments: [{ methodCode: "PIX", amount: "4.50" }],
      items: [{ productId: productAId, quantity: "1" }],
    });
    expect(sale.customerId).toBe(customerAId);
  });

  it("rejeita cliente inválido", async () => {
    const session = await openSession();
    await expect(
      saleSvc.checkout(ctxA, {
        cashSessionId: session.id,
        customerId: "does-not-exist",
        payments: [{ methodCode: "CASH", amount: "4.50" }],
        items: [{ productId: productAId, quantity: "1" }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CUSTOMER" });
  });

  it("rejeita pagamento que não confere com o total (PAYMENT_MISMATCH)", async () => {
    const session = await openSession();
    await expect(
      saleSvc.checkout(ctxA, {
        cashSessionId: session.id,
        payments: [{ methodCode: "CASH", amount: "3.00" }],
        items: [{ productId: productAId, quantity: "1" }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "PAYMENT_MISMATCH" });
  });

  it("rejeita venda sem estoque (STOCK_INSUFFICIENT)", async () => {
    const unit = await db.unitOfMeasure.create({
      data: { tenantId: ctxA.tenantId, code: `UN-NO${regCounter}`, name: "Sem estoque" },
      select: { id: true },
    });
    const prod = await db.product.create({
      data: { tenantId: ctxA.tenantId, name: "Sem estoque", sku: `NO-SK${regCounter}`, basePrice: "2.00", baseUnitId: unit.id },
      select: { id: true },
    });
    await db.productStore.create({ data: { tenantId: ctxA.tenantId, storeId: ctxA.storeId!, productId: prod.id, status: "ACTIVE" } });

    const session = await openSession();
    await expect(
      saleSvc.checkout(ctxA, {
        cashSessionId: session.id,
        payments: [{ methodCode: "CASH", amount: "4.00" }],
        items: [{ productId: prod.id, quantity: "2" }],
      }),
    ).rejects.toMatchObject({ status: 409, code: "STOCK_INSUFFICIENT" });
  });

  it("exige sessão de caixa aberta da mesma unidade", async () => {
    const reg = await cashRegisterSvc.create(ctxA, { storeId: ctxA.storeId!, name: `Caixa F${regCounter}` });
    const open = await cashSessionSvc.open(ctxA, { cashRegisterId: reg.id, openingAmount: "0" });
    await cashSessionSvc.close(ctxA, open.id, { countedByMethod: { CASH: "0" } });

    await expect(
      saleSvc.checkout(ctxA, {
        cashSessionId: open.id,
        payments: [{ methodCode: "CASH", amount: "4.50" }],
        items: [{ productId: productAId, quantity: "1" }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "CASH_SESSION_NOT_OPEN" });

    const otherStore = await db.store.create({ data: { tenantId: ctxA.tenantId, name: "Loja A2", code: "A2", status: "ACTIVE" } });
    const otherCtx: TenantContext = { ...ctxA, storeId: otherStore.id };
    const otherReg = await cashRegisterSvc.create(otherCtx, { storeId: otherStore.id, name: `Caixa Outra Unidade ${regCounter}` });
    const otherStoreSession = await cashSessionSvc.open(otherCtx, { cashRegisterId: otherReg.id, openingAmount: "0" });
    await expect(
      saleSvc.checkout(ctxA, {
        cashSessionId: otherStoreSession.id,
        payments: [{ methodCode: "CASH", amount: "4.50" }],
        items: [{ productId: productAId, quantity: "1" }],
      }),
    ).rejects.toMatchObject({ status: 400, code: "CASH_SESSION_STORE_MISMATCH" });
  });

  it("checkout é idempotente pelo clientOperationId", async () => {
    const session = await openSession();
    const input = {
      cashSessionId: session.id,
      clientOperationId: `op-${regCounter}`,
      payments: [{ methodCode: "CASH", amount: "4.50" }],
      items: [{ productId: productAId, quantity: "1" }],
    };

    const first = await saleSvc.checkout(ctxA, input);
    const second = await saleSvc.checkout(ctxA, input);
    expect(second.id).toBe(first.id);
    expect(await db.cashMovement.count({ where: { tenantId: ctxA.tenantId, referenceId: first.id, type: "SALE" } })).toBe(1);
    expect(await db.sale.count({ where: { tenantId: ctxA.tenantId, clientOperationId: input.clientOperationId } })).toBe(1);
  });

  it("audita SALE_CREATED no checkout", async () => {
    const session = await openSession();
    const sale = await saleSvc.checkout(ctxA, {
      cashSessionId: session.id,
      payments: [{ methodCode: "CASH", amount: "4.50" }],
      items: [{ productId: productAId, quantity: "1" }],
    });
    const logs = await db.auditLog.findMany({
      where: { tenantId: ctxA.tenantId, action: "SALE_CREATED", entityId: sale.id },
    });
    expect(logs).toHaveLength(1);
    const after = logs[0].after as { total: string; payments: { methodCode: string; amount: string }[] };
    expect(Number(after.total)).toBe(4.5);
    expect(after.payments).toEqual([{ methodCode: "CASH", amount: "4.50" }]);
  });
});

describe("Sales F11 — congelamento de preço (F7-11)", () => {
  it("congela preço da tabela de loja no item", async () => {
    await db.priceTable.create({
      data: {
        tenantId: ctxA.tenantId,
        storeId: ctxA.storeId!,
        name: "Tabela Varejo A1",
        defaultPrice: "10.90",
        priority: 5,
        active: true,
      },
    });

    const session = await openSession();
    const sale = await saleSvc.checkout(ctxA, {
      cashSessionId: session.id,
      payments: [{ methodCode: "CASH", amount: "10.90" }],
      items: [{ productId: productAId, quantity: "1" }],
    });

    const item = sale.items[0];
    expect(Number(item.unitPrice)).toBe(10.9);
    expect(item.priceTableId).toBeTruthy();
  });

  it("congela promoção e tabela base no item", async () => {
    await db.promotion.create({
      data: {
        tenantId: ctxA.tenantId,
        productId: productAId,
        discountType: "PERCENTAGE",
        discountValue: "50",
        active: true,
      },
    });

    const session = await openSession();
    const sale = await saleSvc.checkout(ctxA, {
      cashSessionId: session.id,
      payments: [{ methodCode: "CASH", amount: "5.45" }],
      items: [{ productId: productAId, quantity: "1" }],
    });

    const item = sale.items[0];
    expect(Number(item.unitPrice)).toBeCloseTo(5.45, 2);
    expect(item.promotionId).toBeTruthy();
    expect(item.priceTableId).toBeTruthy();
  });
});

describe("Sales F11 — cancelamento", () => {
  it("cancela venda, devolve estoque e audita SALE_CANCELLED", async () => {
    const before = await balanceOf(ctxA, productAId);
    const session = await openSession();
    const sale = await saleSvc.checkout(ctxA, {
      cashSessionId: session.id,
      payments: [{ methodCode: "CASH", amount: "5.45" }],
      items: [{ productId: productAId, quantity: "1" }],
    });
    expect(await balanceOf(ctxA, productAId)).toBe(before - 1);

    const cancelled = await saleSvc.cancel(ctxA, sale.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(await balanceOf(ctxA, productAId)).toBe(before);

    const stockIn = await db.stockMovement.findFirst({
      where: { tenantId: ctxA.tenantId, referenceType: "SALE", referenceId: sale.id, type: "IN" },
    });
    expect(stockIn).toBeTruthy();
    expect(Number(stockIn?.quantity)).toBe(1);

    const logs = await db.auditLog.findMany({
      where: { tenantId: ctxA.tenantId, action: "SALE_CANCELLED", entityId: sale.id },
    });
    expect(logs).toHaveLength(1);
  });

  it("impede cancelar venda já cancelada", async () => {
    const session = await openSession();
    const sale = await saleSvc.checkout(ctxA, {
      cashSessionId: session.id,
      payments: [{ methodCode: "CASH", amount: "5.45" }],
      items: [{ productId: productAId, quantity: "1" }],
    });
    await saleSvc.cancel(ctxA, sale.id);
    await expect(saleSvc.cancel(ctxA, sale.id)).rejects.toMatchObject({
      status: 409,
      code: "SALE_NOT_CANCELLABLE",
    });
  });

  it("venda inexistente → 404", async () => {
    await expect(saleSvc.cancel(ctxA, "nao-existe")).rejects.toMatchObject({
      status: 404,
      code: "SALE_NOT_FOUND",
    });
  });
});

describe("Sales F11 — isolamento multi-tenant", () => {
  it("tenant B não acessa venda criada pelo tenant A", async () => {
    const sessionA = await openSession();
    const saleA = await saleSvc.checkout(ctxA, {
      cashSessionId: sessionA.id,
      payments: [{ methodCode: "CASH", amount: "5.45" }],
      items: [{ productId: productAId, quantity: "1" }],
    });

    await expect(saleSvc.get(ctxB, saleA.id)).rejects.toMatchObject({
      status: 404,
      code: "SALE_NOT_FOUND",
    });
  });

  it("cria venda no tenant B de forma independente", async () => {
    await db.$transaction(async (tx) => {
      const result = await new StockBalanceRepository(db, ctxB).applyDelta(tx, {
        storeId: ctxB.storeId!,
        productId: productBId,
        delta: toDecimal(50),
      });
      expect(result.status).toBe("OK");
    });

    const sessionB = await openSessionB();
    const sale = await saleSvc.checkout(ctxB, {
      cashSessionId: sessionB,
      payments: [{ methodCode: "PIX", amount: "2.00" }],
      items: [{ productId: productBId, quantity: "2" }],
    });
    expect(sale.status).toBe("COMPLETED");
    expect(Number(sale.total)).toBe(2);
    expect(sale.id).toBeTruthy();
  });
});