import type { PrismaClient } from '@/generated/prisma/client';
import type { TenantContext } from '@/modules/tenant/domain/tenant-context';
import { moneySchema } from '@/lib/money';
import { z } from 'zod';
import { SaleRepository, type SaleStatus } from '@/modules/sales/repositories/sale-repository';

const saleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: moneySchema,
  unitPrice: moneySchema,
  discount: moneySchema.default('0'),
  total: moneySchema,
});

const createSaleSchema = z.object({
  storeId: z.string().min(1),
  terminalId: z.string().min(1).optional(),
  cashSessionId: z.string().min(1).optional(),
  operatorId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  priceTableId: z.string().min(1).optional(),
  clientOperationId: z.string().min(1).max(64).optional(),
  subtotal: moneySchema,
  discount: moneySchema.default('0'),
  total: moneySchema,
  items: z.array(saleItemSchema).min(1, 'Venda precisa de ao menos 1 item'),
});

export class SaleService {
  private repo: SaleRepository;

  constructor(private prisma: PrismaClient, private ctx: TenantContext) {
    this.repo = new SaleRepository(this.prisma, this.ctx);
  }

  async checkout(input: unknown) {
    const parsed = createSaleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: { code: 'INVALID_INPUT', issues: parsed.error.flatten() } };
    }
    const data = parsed.data;
    const subtotalSum = data.items.reduce(
      (acc, it) => acc + Number(it.unitPrice) * Number(it.quantity),
      0,
    );
    if (Math.abs(subtotalSum - Number(data.total) - Number(data.discount)) > 0.01) {
      return {
        ok: false as const,
        error: { code: 'INCONSISTENT_TOTALS', message: 'Subtotal não confere com total e desconto' },
      };
    }

    const result = await this.repo.create(data);
    return result.created
      ? { ok: true as const, sale: result.sale }
      : { ok: true as const, sale: result.sale, idempotent: true };
  }

  list(opts: { storeId?: string; status?: SaleStatus; cashSessionId?: string; fromDate?: Date; toDate?: Date } = {}) {
    return this.repo.list(opts);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  findByCashSession(cashSessionId: string) {
    return this.repo.findByCashSession(cashSessionId);
  }

  async cancel(id: string) {
    const sale = await this.repo.findById(id);
    if (!sale) {
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Venda não encontrada' } };
    }
    if (sale.status === 'CANCELLED') {
      return { ok: false as const, error: { code: 'ALREADY_CANCELLED', message: 'Venda já cancelada' } };
    }
    const cancelled = await this.repo.cancel(id);
    return { ok: true as const, sale: cancelled };
  }
}

export function saleService(prisma: PrismaClient, ctx: TenantContext) {
  return new SaleService(prisma, ctx);
}
