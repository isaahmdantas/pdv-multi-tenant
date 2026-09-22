import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { TenantScopedRepository } from '@/modules/tenant/repositories/tenant-scoped-repository';
import type { TenantContext } from '@/modules/tenant/domain/tenant-context';

export const saleInclude = {
  store: { select: { id: true, name: true, code: true } },
  terminal: { select: { id: true, name: true, code: true } },
  operator: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  priceTable: { select: { id: true, name: true } },
  cashSession: { select: { id: true, status: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    include: { product: { select: { id: true, name: true, code: true } } },
  },
} as const;

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export type CreateSaleItemInput = {
  productId: string;
  quantity: Prisma.Decimal | number | string;
  unitPrice: Prisma.Decimal | number | string;
  discount: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
};

export type CreateSaleInput = {
  storeId: string;
  terminalId?: string | null;
  cashSessionId?: string | null;
  operatorId: string;
  customerId?: string | null;
  priceTableId?: string | null;
  clientOperationId?: string | null;
  subtotal: Prisma.Decimal | number | string;
  discount: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
  items: CreateSaleItemInput[];
};

type SaleWithInclude = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

export class SaleRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(
    opts: {
      storeId?: string;
      status?: SaleStatus;
      cashSessionId?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    } = {},
  ): Promise<SaleWithInclude[]> {
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

  async create(input: CreateSaleInput): Promise<{ sale: SaleWithInclude; created: boolean }> {
    if (input.clientOperationId) {
      const existing = await this.findByIdempotencyKey(input.clientOperationId);
      if (existing) return { sale: existing, created: false };
    }

    const sale = await this.prisma.sale.create({
      data: {
        tenantId: this.ctx.tenantId,
        storeId: input.storeId,
        terminalId: input.terminalId ?? null,
        cashSessionId: input.cashSessionId ?? null,
        operatorId: input.operatorId,
        customerId: input.customerId ?? null,
        priceTableId: input.priceTableId ?? null,
        clientOperationId: input.clientOperationId ?? null,
        status: 'COMPLETED',
        subtotal: input.subtotal,
        discount: input.discount,
        total: input.total,
        items: {
          create: input.items.map((it) => ({
            tenantId: this.ctx.tenantId,
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount,
            total: it.total,
          })),
        },
      },
      include: saleInclude,
    });

    return { sale, created: true };
  }

  cancel(id: string): Promise<SaleWithInclude> {
    return this.prisma.sale.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: saleInclude,
    });
  }
}

export function saleRepository(prisma: PrismaClient, ctx: TenantContext): SaleRepository {
  return new SaleRepository(prisma, ctx);
}
