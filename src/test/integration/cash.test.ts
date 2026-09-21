// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CashSessionService } from '@/modules/cash/services/cash-session-service';
import { CashRegisterService } from '@/modules/stores/services/cash-register-service';
import { createTestDb } from '@/test/integration/db';

const TRUNCATE_TABLES = [
  'AuditLog',
  'StockBalance',
  'StockMovement',
  'CashMovement',
  'CashSession',
  'CashRegister',
  'ProductStore',
  'ProductBarcode',
  'Product',
  'ProductCategory',
  'UnitConversion',
  'UnitOfMeasure',
  'Customer',
  'CustomerCategory',
  'UserStore',
  'UserRole',
  'RolePermission',
  'User',
  'Role',
  'Permission',
  'Store',
  'Tenant',
];

const db = createTestDb();

const cashSessionSvcA = new CashSessionService(db);
const cashRegisterSvcA = new CashRegisterService(db);
const cashSessionSvcB = new CashSessionService(db);

const PERMS = [
  'cash.open',
  'cash.close',
  'cash.withdraw',
  'cash.supply',
  'reports.view',
];

let ctxA: { tenantId: string; userId: string; storeId: string; role: string; permissions: string[] };
let ctxB: { tenantId: string; userId: string; storeId: string; role: string; permissions: string[] };
let storeA1Id: string;
let storeB1Id: string;
let regCounter = 0;

beforeAll(async () => {
  await db.$executeRawUnsafe(
    `TRUNCATE ${TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`,
  );

  const tenantA = await db.tenant.create({ data: { name: 'Tenant A', slug: 'tenant-a', status: 'ACTIVE' } });
  const tenantB = await db.tenant.create({ data: { name: 'Tenant B', slug: 'tenant-b', status: 'ACTIVE' } });

  for (const t of [tenantA, tenantB]) {
    for (const code of PERMS) {
      await db.permission.create({ data: { tenantId: t.id, code, description: code } });
    }
  }

  const roleA = await db.role.create({ data: { tenantId: tenantA.id, name: 'ADMIN', description: 'Admin A', globalStoreAccess: true } });
  const roleB = await db.role.create({ data: { tenantId: tenantB.id, name: 'ADMIN', description: 'Admin B', globalStoreAccess: true } });

  const permsA = await db.permission.findMany({ where: { tenantId: tenantA.id } });
  const permsB = await db.permission.findMany({ where: { tenantId: tenantB.id } });
  await db.rolePermission.createMany({
    data: permsA.map((p) => ({ tenantId: tenantA.id, roleId: roleA.id, permissionId: p.id })),
  });
  await db.rolePermission.createMany({
    data: permsB.map((p) => ({ tenantId: tenantB.id, roleId: roleB.id, permissionId: p.id })),
  });

  const userA = await db.user.create({ data: { tenantId: tenantA.id, name: 'Admin A', email: 'admin-a@test.com', passwordHash: 'hash', status: 'ACTIVE' } });
  const userB = await db.user.create({ data: { tenantId: tenantB.id, name: 'Admin B', email: 'admin-b@test.com', passwordHash: 'hash', status: 'ACTIVE' } });
  await db.userRole.createMany({
    data: [
      { tenantId: tenantA.id, userId: userA.id, roleId: roleA.id },
      { tenantId: tenantB.id, userId: userB.id, roleId: roleB.id },
    ],
  });

  const storeA1 = await db.store.create({ data: { tenantId: tenantA.id, name: 'Loja A1', code: 'A1', status: 'ACTIVE' } });
  const storeB1 = await db.store.create({ data: { tenantId: tenantB.id, name: 'Loja B1', code: 'B1', status: 'ACTIVE' } });
  storeA1Id = storeA1.id;
  storeB1Id = storeB1.id;

  await db.userStore.createMany({
    data: [
      { tenantId: tenantA.id, userId: userA.id, storeId: storeA1Id },
      { tenantId: tenantB.id, userId: userB.id, storeId: storeB1Id },
    ],
  });

  ctxA = { tenantId: tenantA.id, userId: userA.id, storeId: storeA1Id, role: 'ADMIN', permissions: PERMS };
  ctxB = { tenantId: tenantB.id, userId: userB.id, storeId: storeB1Id, role: 'ADMIN', permissions: PERMS };
});

afterAll(async () => {
  await db.$disconnect();
});

// Cada teste cria um caixa próprio para garantir isolamento (uma sessão OPEN por caixa).
async function newRegisterA(): Promise<string> {
  regCounter += 1;
  const reg = await cashRegisterSvcA.create(ctxA, { storeId: storeA1Id, name: `Caixa A ${regCounter}` });
  return reg.id;
}

describe('CashSession F10', () => {
  it('abre sessão de caixa com valor inicial', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100.00' });
    expect(session.status).toBe('OPEN');
    expect(Number(session.openingAmount)).toBe(100);
    expect(session.cashRegisterId).toBe(regId);

    const movements = await cashSessionSvcA.getMovements(ctxA, session.id);
    const opening = movements.find((m) => m.type === 'OPENING');
    expect(opening).toBeDefined();
    expect(Number(opening?.amount)).toBe(100);
  });

  it('abre sessão sem valor inicial (sem movimento OPENING)', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '0' });
    expect(Number(session.openingAmount)).toBe(0);
    const movements = await cashSessionSvcA.getMovements(ctxA, session.id);
    expect(movements.find((m) => m.type === 'OPENING')).toBeUndefined();
  });

  it('impede abrir duas sessões no mesmo caixa', async () => {
    const regId = await newRegisterA();
    await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '50' });
    await expect(
      cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '50' }),
    ).rejects.toMatchObject({ code: 'CASH_SESSION_ALREADY_OPEN' });
  });

  it('abertura exige caixa da unidade atual', async () => {
    const regA = await newRegisterA();
    const otherCtx = { ...ctxA, storeId: storeB1Id };
    await expect(
      cashSessionSvcA.open(otherCtx, { cashRegisterId: regA, openingAmount: '10' }),
    ).rejects.toMatchObject({ code: 'INVALID_CASH_REGISTER' });
  });

  it('suprimento adiciona movimento e mantém sessão OPEN', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    const updated = await cashSessionSvcA.supply(ctxA, session.id, { amount: '50.00', methodCode: 'PIX' });
    expect(updated.status).toBe('OPEN');
    expect(updated.movements.some((m) => m.type === 'SUPPLY' && Number(m.amount) === 50)).toBe(true);
  });

  it('sangria adiciona movimento', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '200' });
    const updated = await cashSessionSvcA.withdraw(ctxA, session.id, { amount: '30.00', methodCode: 'CASH' });
    expect(updated.movements.some((m) => m.type === 'WITHDRAW' && Number(m.amount) === 30)).toBe(true);
  });

  it('fecha caixa calculando diferença exata (EXACT)', async () => {
  const regId = await newRegisterA();
  const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100.00' });
  await cashSessionSvcA.supply(ctxA, session.id, { amount: '50.00', methodCode: 'PIX' });
  await cashSessionSvcA.withdraw(ctxA, session.id, { amount: '20.00', methodCode: 'CASH' });

  const closed = await cashSessionSvcA.close(ctxA, session.id, {
    countedByMethod: { CASH: '80.00', PIX: '50.00' },
  });

  expect(closed.status).toBe('CLOSED');
  expect(Number(closed.closingAmount)).toBe(130);
  expect(Number(closed.difference)).toBe(0);
  expect(closed.classification).toBe('EXACT');
  expect(closed.closedAt).toBeInstanceOf(Date);
});

it('detecta sobra (SURPLUS)', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100.00' });
    const closed = await cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '110.00' } });
    expect(Number(closed.difference)).toBe(10);
    expect(closed.classification).toBe('SURPLUS');
  });

  it('detecta falta (SHORTAGE)', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100.00' });
    const closed = await cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '90.00' } });
    expect(Number(closed.difference)).toBe(-10);
    expect(closed.classification).toBe('SHORTAGE');
  });

  it('impede fechar caixa já fechado', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    await cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '100' } });
    await expect(
      cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '100' } }),
    ).rejects.toMatchObject({ code: 'CASH_SESSION_NOT_OPEN' });
  });

  it('impede suprimento em caixa fechado', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    await cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '100' } });
    await expect(cashSessionSvcA.supply(ctxA, session.id, { amount: '50', methodCode: 'CASH' })).rejects.toMatchObject({ code: 'CASH_SESSION_NOT_OPEN' });
  });

  it('impede sangria em caixa fechado', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    await cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '100' } });
    await expect(cashSessionSvcA.withdraw(ctxA, session.id, { amount: '50', methodCode: 'CASH' })).rejects.toMatchObject({ code: 'CASH_SESSION_NOT_OPEN' });
  });

  it('isolamento multi-tenant: tenant B não vê sessão de A (404)', async () => {
    const regId = await newRegisterA();
    const sessionA = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    await expect(cashSessionSvcB.get(ctxB, sessionA.id)).rejects.toMatchObject({ code: 'CASH_SESSION_NOT_FOUND' });
  });

  it('mesmo caixa pode ser reaberto após fechamento', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    await cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '100' } });
    const session2 = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '50' });
    expect(session2.id).not.toBe(session.id);
    expect(Number(session2.openingAmount)).toBe(50);
  });

  it('lista sessões com filtro de status', async () => {
    const regId = await newRegisterA();
    await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    const all = await cashSessionSvcA.list(ctxA, { status: 'OPEN' });
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((s) => s.status === 'OPEN')).toBe(true);
  });

  it('audita CASH_OPENED/CASH_SUPPLY/CASH_WITHDRAWAL/CASH_CLOSED', async () => {
    const regId = await newRegisterA();
    const session = await cashSessionSvcA.open(ctxA, { cashRegisterId: regId, openingAmount: '100' });
    await cashSessionSvcA.supply(ctxA, session.id, { amount: '10', methodCode: 'CASH' });
    await cashSessionSvcA.withdraw(ctxA, session.id, { amount: '5', methodCode: 'CASH' });
    await cashSessionSvcA.close(ctxA, session.id, { countedByMethod: { CASH: '105' } });

    const logs = await db.auditLog.findMany({
      where: { tenantId: ctxA.tenantId },
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('CASH_OPENED');
    expect(actions).toContain('CASH_SUPPLY');
    expect(actions).toContain('CASH_WITHDRAWAL');
    expect(actions).toContain('CASH_CLOSED');
  });
});