import type { PrismaClient } from '@/generated/prisma/client';
import { TenantScopedRepository } from '@/modules/tenant/repositories/tenant-scoped-repository';
import type { TenantContext } from '@/modules/tenant/domain/tenant-context';

export class CashMovementRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  listBySession(cashSessionId: string) {
    return this.prisma.cashMovement.findMany({
      where: {
        ...this.scope({ cashSessionId }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  list(opts: { storeId?: string; cashSessionId?: string; type?: string; fromDate?: Date; toDate?: Date } = {}) {
    const storeId = opts.storeId ?? this.ctx.storeId ?? undefined;
    return this.prisma.cashMovement.findMany({
      where: {
        ...this.scope({}),
        ...(storeId ? { storeId } : {}),
        ...(opts.cashSessionId ? { cashSessionId: opts.cashSessionId } : {}),
        ...(opts.type ? { type: opts.type } : {}),
        ...(opts.fromDate || opts.toDate
          ? {
              createdAt: {
                ...(opts.fromDate ? { gte: opts.fromDate } : {}),
                ...(opts.toDate ? { lte: opts.toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export function cashMovementRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new CashMovementRepository(prisma, ctx);
}