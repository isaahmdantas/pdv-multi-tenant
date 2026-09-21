import type { PrismaClient, Prisma } from '@/generated/prisma/client';
import type { TenantContext } from '@/modules/tenant/domain/tenant-context';
import type { OpenCashSessionInput, SupplyInput, WithdrawInput, CloseCashSessionInput, CashSessionQueryInput } from '@/modules/cash/schemas';
import { CashSessionRepository } from '@/modules/cash/repositories/cash-session-repository';
import { CashMovementRepository } from '@/modules/cash/repositories/cash-movement-repository';
import { AuditService } from '@/modules/audit/services/audit-service';
import { badRequest, conflict, notFound } from '@/lib/api/errors';
import { toDecimal } from '@/lib/money';

interface Totals {
  sales: Prisma.Decimal;
  supplies: Prisma.Decimal;
  withdraws: Prisma.Decimal;
  expected: Prisma.Decimal;
}

export class CashSessionService {
  constructor(private readonly prisma: PrismaClient) {}

  private repo(ctx: TenantContext) {
    return new CashSessionRepository(this.prisma, ctx);
  }

  private movementRepo(ctx: TenantContext) {
    return new CashMovementRepository(this.prisma, ctx);
  }

  list(ctx: TenantContext, opts: CashSessionQueryInput = {}) {
    return this.repo(ctx).list(opts);
  }

  async get(ctx: TenantContext, id: string) {
    const row = await this.repo(ctx).findById(id);
    if (!row) throw notFound('Sessão de caixa não encontrada', 'CASH_SESSION_NOT_FOUND');
    return row;
  }

  async open(ctx: TenantContext, input: OpenCashSessionInput, meta?: { ip?: string; device?: string }) {
    const { cashRegisterId, openingAmount, notes } = input;

    await this.assertRegisterOfTenant(ctx, cashRegisterId);

    const existingOpen = await this.repo(ctx).findOpenByRegister(cashRegisterId);
    if (existingOpen) {
      throw conflict('Já existe uma sessão aberta neste caixa', 'CASH_SESSION_ALREADY_OPEN');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: ctx.storeId!,
          cashRegisterId,
          openedBy: ctx.userId,
          openingAmount: toDecimal(openingAmount),
          status: 'OPEN',
        },
        include: { cashRegister: { select: { id: true, name: true } }, store: { select: { id: true, name: true, code: true } } },
      });

      if (openingAmount && toDecimal(openingAmount).gt(0)) {
        await tx.cashMovement.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: ctx.storeId!,
            cashSessionId: session.id,
            type: 'OPENING',
            methodCode: 'CASH',
            amount: toDecimal(openingAmount),
            notes: notes ?? 'Abertura de caixa',
            createdBy: ctx.userId,
          },
        });
      }

      await new AuditService(tx).log({
        ctx,
        action: 'CASH_OPENED',
        entity: 'CashSession',
        entityId: session.id,
        after: { cashRegisterId, openingAmount, status: 'OPEN' },
        ip: meta?.ip,
        device: meta?.device,
      });

      return session;
    });

    return created;
  }

  async supply(ctx: TenantContext, id: string, input: SupplyInput, meta?: { ip?: string; device?: string }) {
    const session = await this.getOrFail(ctx, id, 'OPEN');
    const { amount, methodCode, notes } = input;

    await this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: ctx.storeId!,
          cashSessionId: session.id,
          type: 'SUPPLY',
          methodCode,
          amount: toDecimal(amount),
          notes: notes ?? 'Suprimento',
          createdBy: ctx.userId,
        },
      });

      await new AuditService(tx).log({
        ctx,
        action: 'CASH_SUPPLY',
        entity: 'CashMovement',
        entityId: movement.id,
        after: { cashSessionId: session.id, type: 'SUPPLY', amount, methodCode },
        ip: meta?.ip,
        device: meta?.device,
      });
    });

    const updated = await this.repo(ctx).findById(id, true);
    if (!updated) throw notFound('Sessão de caixa não encontrada', 'CASH_SESSION_NOT_FOUND');
    return updated;
  }

  async withdraw(ctx: TenantContext, id: string, input: WithdrawInput, meta?: { ip?: string; device?: string }) {
    const session = await this.getOrFail(ctx, id, 'OPEN');
    const { amount, methodCode, notes } = input;
    await this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: ctx.storeId!,
          cashSessionId: session.id,
          type: 'WITHDRAW',
          methodCode,
          amount: toDecimal(amount),
          notes: notes ?? 'Sangria',
          createdBy: ctx.userId,
        },
      });

      await new AuditService(tx).log({
        ctx,
        action: 'CASH_WITHDRAWAL',
        entity: 'CashMovement',
        entityId: movement.id,
        after: { cashSessionId: session.id, type: 'WITHDRAW', amount, methodCode },
        ip: meta?.ip,
        device: meta?.device,
      });
    });

    const updated = await this.repo(ctx).findById(id, true);
    if (!updated) throw notFound('Sessão de caixa não encontrada', 'CASH_SESSION_NOT_FOUND');
    return updated;
  }

  async close(ctx: TenantContext, id: string, input: CloseCashSessionInput, meta?: { ip?: string; device?: string }) {
    const session = await this.getOrFail(ctx, id, 'OPEN');
    const { countedByMethod } = input;

    const totals = await this.calculateTotals(ctx, session.id);

    let totalCounted = toDecimal(0);
    for (const amount of Object.values(countedByMethod)) {
      totalCounted = totalCounted.add(toDecimal(String(amount)));
    }

    const difference = totalCounted.sub(totals.expected);
    let classification: 'EXACT' | 'SURPLUS' | 'SHORTAGE';
    if (difference.eq(0)) classification = 'EXACT';
    else if (difference.gt(0)) classification = 'SURPLUS';
    else classification = 'SHORTAGE';

    const updated = await this.prisma.$transaction(async (tx) => {
      const closedSession = await tx.cashSession.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closingAmount: totals.expected,
          difference,
          classification,
          closedAt: new Date(),
        },
        include: { cashRegister: { select: { id: true, name: true } }, store: { select: { id: true, name: true, code: true } } },
      });

      await tx.cashMovement.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: ctx.storeId!,
          cashSessionId: session.id,
          type: 'CLOSING',
          methodCode: null,
          amount: difference,
          notes: `Fechamento de caixa — ${classification}`,
          createdBy: ctx.userId,
        },
      });

      await new AuditService(tx).log({
        ctx,
        action: 'CASH_CLOSED',
        entity: 'CashSession',
        entityId: session.id,
        before: { status: 'OPEN', openingAmount: session.openingAmount },
        after: {
          status: 'CLOSED',
          closingAmount: totals.expected,
          difference,
          classification,
          countedByMethod,
        },
        ip: meta?.ip,
        device: meta?.device,
      });

      return closedSession;
    });

    return updated;
  }

  async getMovements(ctx: TenantContext, cashSessionId: string) {
    await this.get(ctx, cashSessionId);
    return this.movementRepo(ctx).listBySession(cashSessionId);
  }

  private async getOrFail(ctx: TenantContext, id: string, expectedStatus: string) {
    const session = await this.repo(ctx).findById(id, true);
    if (!session) throw notFound('Sessão de caixa não encontrada', 'CASH_SESSION_NOT_FOUND');
    if (session.status !== expectedStatus) {
      throw badRequest(`Sessão de caixa não está ${expectedStatus}`, `CASH_SESSION_NOT_${expectedStatus}`);
    }
    if (session.storeId !== ctx.storeId) {
      throw badRequest('Sessão não pertence à unidade atual', 'CASH_SESSION_STORE_MISMATCH');
    }
    return session;
  }

  private async assertRegisterOfTenant(ctx: TenantContext, cashRegisterId: string) {
    const reg = await this.prisma.cashRegister.findFirst({
      where: { tenantId: ctx.tenantId, id: cashRegisterId, storeId: ctx.storeId!, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!reg) throw badRequest('Caixa não pertence a esta unidade', 'INVALID_CASH_REGISTER');
  }

  private async calculateTotals(ctx: TenantContext, cashSessionId: string): Promise<Totals> {
    const movements = await this.movementRepo(ctx).listBySession(cashSessionId);

    let sales = toDecimal(0);
    let supplies = toDecimal(0);
    let withdraws = toDecimal(0);

    for (const m of movements) {
      const amt = toDecimal(String(m.amount));
      switch (m.type) {
        case 'SALE':
          sales = sales.add(amt);
          break;
        case 'SUPPLY':
        case 'OPENING':
          supplies = supplies.add(amt);
          break;
        case 'WITHDRAW':
          withdraws = withdraws.add(amt);
          break;
      }
    }

    const expected = sales.add(supplies).sub(withdraws);

    return { sales, supplies, withdraws, expected };
  }
}