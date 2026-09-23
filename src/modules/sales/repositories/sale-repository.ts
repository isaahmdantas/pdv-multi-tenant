import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { TenantScopedRepository } from '@/modules/tenant/repositories/tenant-scoped-repository';
import type { TenantContext } from '@/modules/tenant/domain/tenant-context';
import type { SaleStatus } from '@/modules/sales/constants';

export const saleInclude = {
  store: { select: { id: true, name: true, code: true } },
  terminal: { select: { id: true, name: true, code: true } },
  operator: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  priceTable: { select: { id: true, name: true } },
  cashSession: { select: { id: true, status: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    include: { product: { select: { id: true, name: true, sku: true } } },
  },
} as const;

export type SaleWithInclude = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

export type SaleQueryOpts = {
  storeId?: string;
  status?: SaleStatus;
  cashSessionId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
};

export class SaleRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(opts: SaleQueryOpts = {}): Promise<SaleWithInclude[]> {
    return this.prisma.sale.findMany({
      where: {
        ...this.scope({}),
        ...(opts.storeId ? { storeId: opts.storeId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.cashSessionId ? { cashSessionId: opts.cashSessionId } : {}),
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
      take: opts.limit ?? 50,
      include: saleInclude,
    });
  }

  findById(id: string): Promise<SaleWithInclude | null> {
    return this.prisma.sale.findFirst({
      where: this.scope({ id }),
      include: saleInclude,
    });
  }

  findByIdempotencyKey(clientOperationId: string): Promise<SaleWithInclude | null> {
    return this.prisma.sale.findFirst({
      where: this.scope({ clientOperationId }),
      include: saleInclude,
    });
  }

  findByCashSession(cashSessionId: string): Promise<SaleWithInclude[]> {
    return this.prisma.sale.findMany({
      where: this.scope({ cashSessionId }),
      orderBy: { createdAt: 'asc' },
      include: saleInclude,
    });
  }
}

export function saleRepository(prisma: PrismaClient, ctx: TenantContext): SaleRepository {
  return new SaleRepository(prisma, ctx);
}