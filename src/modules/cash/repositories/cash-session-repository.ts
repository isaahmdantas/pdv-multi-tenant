import type { PrismaClient } from '@/generated/prisma/client';
import { TenantScopedRepository } from '@/modules/tenant/repositories/tenant-scoped-repository';
import type { TenantContext } from '@/modules/tenant/domain/tenant-context';

export const cashSessionInclude = {
  cashRegister: { select: { id: true, name: true } },
  store: { select: { id: true, name: true, code: true } },
  movements: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      methodCode: true,
      amount: true,
      notes: true,
      referenceType: true,
      referenceId: true,
      createdBy: true,
      createdAt: true,
    },
  },
} as const;

export class CashSessionRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(opts: { storeId?: string; status?: string; cashRegisterId?: string; fromDate?: Date; toDate?: Date } = {}) {
    const storeId = opts.storeId ?? this.ctx.storeId ?? undefined;
    return this.prisma.cashSession.findMany({
      where: {
        ...this.scope({}),
        ...(storeId ? { storeId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.cashRegisterId ? { cashRegisterId: opts.cashRegisterId } : {}),
        ...(opts.fromDate || opts.toDate
          ? {
              openedAt: {
                ...(opts.fromDate ? { gte: opts.fromDate } : {}),
                ...(opts.toDate ? { lte: opts.toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { openedAt: 'desc' },
      include: cashSessionInclude,
    });
  }

  findById(id: string, storeScope = false) {
    const where = storeScope && this.ctx.storeId
      ? this.scopeStore({ id })
      : this.scope({ id });
    return this.prisma.cashSession.findFirst({
      where,
      include: cashSessionInclude,
    });
  }

  findOpenByRegister(cashRegisterId: string) {
    return this.prisma.cashSession.findFirst({
      where: {
        ...this.scope({ cashRegisterId, status: 'OPEN' }),
      },
      include: cashSessionInclude,
    });
  }
}

export function cashSessionRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new CashSessionRepository(prisma, ctx);
}