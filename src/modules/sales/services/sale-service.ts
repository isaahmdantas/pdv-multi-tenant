import { PrismaClient, Prisma } from '@/generated/prisma/client';
import type { TenantContext } from '@/modules/tenant/domain/tenant-context';
import type { CreateSaleInput, RefundSaleInput, SuspendSaleInput } from '@/modules/sales/schemas';
import { SaleRepository, type SaleQueryOpts, type SaleWithInclude } from '@/modules/sales/repositories/sale-repository';
import { saleInclude } from '@/modules/sales/repositories/sale-repository';
import { PricingService } from '@/modules/pricing/services/pricing-service';
import { StockBalanceRepository } from '@/modules/inventory/repositories/stock-balance-repository';
import { AuditService } from '@/modules/audit/services/audit-service';
import { badRequest, conflict, notFound } from '@/lib/api/errors';
import { toDecimal } from '@/lib/money';

interface ResolvedItem {
  productId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  priceTableId?: string;
  promotionId?: string;
}

export class SaleService {
  private readonly pricing: PricingService;

  constructor(private readonly prisma: PrismaClient) {
    this.pricing = new PricingService(this.prisma);
  }

  private repo(ctx: TenantContext) {
    return new SaleRepository(this.prisma, ctx);
  }

  list(ctx: TenantContext, opts: SaleQueryOpts = {}) {
    return this.repo(ctx).list(opts);
  }

  async get(ctx: TenantContext, id: string) {
    const row = await this.repo(ctx).findById(id);
    if (!row) throw notFound('Venda não encontrada', 'SALE_NOT_FOUND');
    return row;
  }

  findByCashSession(ctx: TenantContext, cashSessionId: string) {
    return this.repo(ctx).findByCashSession(cashSessionId);
  }

  private async validateStore(ctx: TenantContext, storeId?: string) {
    const id = storeId ?? ctx.storeId;
    if (!id) throw badRequest('Informe a unidade (storeId)', 'STORE_REQUIRED');
    const store = await this.prisma.store.findFirst({
      where: { tenantId: ctx.tenantId, id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!store) throw badRequest('Unidade inválida', 'INVALID_STORE');
    return id;
  }

  private async validateCashSession(ctx: TenantContext, cashSessionId: string, storeId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { tenantId: ctx.tenantId, id: cashSessionId },
      select: { id: true, storeId: true, status: true },
    });
    if (!session) throw notFound('Sessão de caixa não encontrada', 'CASH_SESSION_NOT_FOUND');
    if (session.status !== 'OPEN') {
      throw badRequest('Sessão de caixa não está aberta', 'CASH_SESSION_NOT_OPEN');
    }
    if (session.storeId !== storeId) {
      throw badRequest('Sessão não pertence à unidade da venda', 'CASH_SESSION_STORE_MISMATCH');
    }
    return session;
  }

  private async validateCustomer(ctx: TenantContext, customerId?: string | null) {
    if (!customerId) return;
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId: ctx.tenantId, id: customerId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!customer) throw badRequest('Cliente inválido', 'INVALID_CUSTOMER');
  }

  private async loadProducts(ctx: TenantContext, storeId: string, productIds: string[]) {
    const ids = [...new Set(productIds)];
    const products = await this.prisma.product.findMany({
      where: { tenantId: ctx.tenantId, id: { in: ids }, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const id of ids) {
      if (!byId.has(id)) throw notFound('Produto não encontrado', 'PRODUCT_NOT_FOUND');
    }

    const storeLinks = await this.prisma.productStore.findMany({
      where: { tenantId: ctx.tenantId, storeId, productId: { in: ids }, status: 'ACTIVE' },
      select: { productId: true },
    });
    const storeActive = new Set(storeLinks.map((l) => l.productId));
    for (const id of ids) {
      if (!storeActive.has(id)) {
        throw badRequest('Produto não está ativo nesta unidade', 'PRODUCT_NOT_ACTIVE_IN_STORE');
      }
    }
    return new Map([...byId.entries()].filter(([id]) => storeActive.has(id)));
  }

  private async resolveItems(
    ctx: TenantContext,
    storeId: string,
    items: CreateSaleInput['items'],
    customerId?: string | null,
  ): Promise<ResolvedItem[]> {
    const resolved: ResolvedItem[] = [];
    for (const item of items) {
      const pricing = await this.pricing.resolve({
        tenantId: ctx.tenantId,
        storeId,
        productId: item.productId,
        customerId: customerId ?? null,
        quantity: Number(item.quantity),
      });

      const quantity = toDecimal(item.quantity);
      const lineSubtotal = pricing.unitPrice.mul(quantity);
      const discount = toDecimal(item.discount ?? '0');
      if (discount.gt(lineSubtotal)) {
        throw badRequest('Desconto maior que o subtotal do item', 'INVALID_DISCOUNT');
      }

      resolved.push({
        productId: item.productId,
        quantity,
        unitPrice: pricing.unitPrice,
        discount,
        total: lineSubtotal.sub(discount),
        priceTableId: pricing.priceTableId,
        promotionId: pricing.promotionId,
      });
    }
    return resolved;
  }

  async checkout(
    ctx: TenantContext,
    input: CreateSaleInput,
    meta?: { ip?: string; device?: string },
  ) {
    const storeId = await this.validateStore(ctx, input.storeId);
    const session = await this.validateCashSession(ctx, input.cashSessionId, storeId);
    await this.validateCustomer(ctx, input.customerId);

    const items = await this.resolveItems(ctx, storeId, input.items, input.customerId);
    const subtotal = items.reduce((acc, it) => acc.add(it.total), toDecimal(0));
    const discount = toDecimal(input.discount ?? '0');
    if (discount.gt(subtotal)) {
      throw badRequest('Desconto maior que o subtotal da venda', 'INVALID_DISCOUNT');
    }
    const total = subtotal.sub(discount);

    const paymentsSum = input.payments.reduce(
      (acc, p) => acc.add(toDecimal(p.amount)),
      toDecimal(0),
    );
    if (!paymentsSum.sub(total).abs().lte(toDecimal('0.01'))) {
      throw badRequest(
        'A soma dos pagamentos não confere com o total da venda',
        'PAYMENT_MISMATCH',
      );
    }

    if (input.clientOperationId) {
      const existing = await this.repo(ctx).findByIdempotencyKey(input.clientOperationId);
      if (existing) return existing;
    }

    const balanceRepo = new StockBalanceRepository(this.prisma, ctx);

    try {
      const sale = await this.prisma.$transaction(async (tx) => {
        const created = await tx.sale.create({
          data: {
            tenantId: ctx.tenantId,
            storeId,
            terminalId: input.terminalId ?? null,
            cashSessionId: session.id,
            operatorId: ctx.userId,
            customerId: input.customerId ?? null,
            clientOperationId: input.clientOperationId ?? null,
            status: 'COMPLETED',
            subtotal,
            discount,
            total,
            items: {
              create: items.map((it) => ({
                tenantId: ctx.tenantId,
                productId: it.productId,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                discount: it.discount,
                total: it.total,
                priceTableId: it.priceTableId ?? null,
                promotionId: it.promotionId ?? null,
              })),
            },
          },
        });

        for (const it of items) {
          const result = await balanceRepo.applyDelta(tx, {
            storeId,
            productId: it.productId,
            delta: it.quantity.negated(),
          });
          if (result.status !== 'OK') {
            throw conflict('Estoque insuficiente', 'STOCK_INSUFFICIENT');
          }
          await tx.stockMovement.create({
            data: {
              tenantId: ctx.tenantId,
              storeId,
              productId: it.productId,
              type: 'OUT',
              quantity: it.quantity,
              balanceAfter: result.balanceAfter!,
              reason: 'Saída por venda',
              referenceType: 'SALE',
              referenceId: created.id,
              createdBy: ctx.userId,
            },
          });
        }

        for (const payment of input.payments) {
          await tx.cashMovement.create({
            data: {
              tenantId: ctx.tenantId,
              storeId,
              cashSessionId: session.id,
              type: 'SALE',
              methodCode: payment.methodCode,
              amount: toDecimal(payment.amount),
              notes: 'Pagamento da venda',
              referenceType: 'SALE',
              referenceId: created.id,
              createdBy: ctx.userId,
            },
          });
        }

        await new AuditService(tx).log({
          ctx,
          action: 'SALE_CREATED',
          entity: 'Sale',
          entityId: created.id,
          after: {
            storeId,
            customerId: input.customerId ?? null,
            subtotal,
            discount,
            total,
            items: items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity.toString(),
              unitPrice: it.unitPrice.toString(),
              total: it.total.toString(),
            })),
            payments: input.payments,
          },
          ip: meta?.ip,
          device: meta?.device,
        });

        return created;
      });

      const full = await this.repo(ctx).findById(sale.id);
      if (!full) throw notFound('Venda não encontrada', 'SALE_NOT_FOUND');
      return full;
    } catch (err) {
      if (
        input.clientOperationId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.repo(ctx).findByIdempotencyKey(input.clientOperationId);
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * F11-10 — Suspende a venda corrente sem movimentar estoque/caixa.
   * Cria Sale status SUSPENDED apenas com itens (preços congelados pelo
   * PricingService) e cliente/desconto. Não cria CashMovement nem StockMovement:
   * o estoque só é dado baixa quando a venda for recuperada e finalizada.
   */
  async suspend(
    ctx: TenantContext,
    input: SuspendSaleInput,
    meta?: { ip?: string; device?: string },
  ) {
    const storeId = await this.validateStore(ctx, input.storeId);
    await this.validateCustomer(ctx, input.customerId);

    const items = await this.resolveItems(ctx, storeId, input.items, input.customerId);
    const subtotal = items.reduce((acc, it) => acc.add(it.total), toDecimal(0));
    const discount = toDecimal(input.discount ?? '0');
    if (discount.gt(subtotal)) {
      throw badRequest('Desconto maior que o subtotal da venda', 'INVALID_DISCOUNT');
    }
    const total = subtotal.sub(discount);

    const created = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId: ctx.tenantId,
          storeId,
          operatorId: ctx.userId,
          customerId: input.customerId ?? null,
          status: 'SUSPENDED',
          subtotal,
          discount,
          total,
          items: {
            create: items.map((it) => ({
              tenantId: ctx.tenantId,
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount,
              total: it.total,
              priceTableId: it.priceTableId ?? null,
              promotionId: it.promotionId ?? null,
            })),
          },
        },
      });

      await new AuditService(tx).log({
        ctx,
        action: 'SALE_SUSPENDED',
        entity: 'Sale',
        entityId: sale.id,
        after: {
          storeId,
          customerId: input.customerId ?? null,
          subtotal,
          discount,
          total,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity.toString(),
            unitPrice: it.unitPrice.toString(),
            total: it.total.toString(),
          })),
        },
        ip: meta?.ip,
        device: meta?.device,
      });

      return sale;
    });

    const full = await this.repo(ctx).findById(created.id);
    if (!full) throw notFound('Venda não encontrada', 'SALE_NOT_FOUND');
    return full;
  }

  /**
   * F11-11 — Recupera uma venda suspensa para o carrinho. Devolve a venda com
   * itens e remove o rascunho SUSPENDED (o carrinho passa a viver no cliente).
   */
  async recover(ctx: TenantContext, id: string): Promise<SaleWithInclude> {
    return this.consumeSuspended(ctx, id);
  }

  /**
   * F11-11 — Descarta uma venda suspensa (rascunho) sem efeitos de estoque/caixa.
   */
  async discard(ctx: TenantContext, id: string) {
    await this.consumeSuspended(ctx, id);
    return true;
  }

  private async consumeSuspended(ctx: TenantContext, id: string): Promise<SaleWithInclude> {
    const sale = await this.prisma.$transaction(async (tx) => {
      const found = await tx.sale.findFirst({
        where: { tenantId: ctx.tenantId, id, status: 'SUSPENDED' },
        include: saleInclude,
      });
      if (!found) throw conflict('Venda não está suspensa', 'SALE_NOT_SUSPENDED');
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.sale.deleteMany({ where: { id, tenantId: ctx.tenantId, status: 'SUSPENDED' } });
      return found;
    });
    return sale;
  }

  async cancel(
    ctx: TenantContext,
    id: string,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = this.repo(ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound('Venda não encontrada', 'SALE_NOT_FOUND');
    if (existing.status !== 'COMPLETED') {
      throw conflict('Apenas vendas concluídas podem ser canceladas', 'SALE_NOT_CANCELLABLE');
    }

    const balanceRepo = new StockBalanceRepository(this.prisma, ctx);

    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      for (const item of existing.items) {
        const quantity = toDecimal(String(item.quantity));
        const result = await balanceRepo.applyDelta(tx, {
          storeId: existing.storeId,
          productId: item.productId,
          delta: quantity,
        });
        if (result.status !== 'OK') {
          throw conflict('Não foi possível devolver o estoque', 'STOCK_APPLY_FAILED');
        }
        await tx.stockMovement.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: existing.storeId,
            productId: item.productId,
            type: 'IN',
            quantity,
            balanceAfter: result.balanceAfter!,
            reason: 'Devolução por cancelamento de venda',
            referenceType: 'SALE',
            referenceId: id,
            createdBy: ctx.userId,
          },
        });
      }

      await new AuditService(tx).log({
        ctx,
        action: 'SALE_CANCELLED',
        entity: 'Sale',
        entityId: id,
        before: { status: existing.status },
        after: { status: 'CANCELLED' },
        ip: meta?.ip,
        device: meta?.device,
      });
    });

    const updated = await repo.findById(id);
    if (!updated) throw notFound('Venda não encontrada', 'SALE_NOT_FOUND');
    return updated;
  }

  /**
   * F12-07 — Estorno total ou parcial por item.
   * Devolve estoque (StockMovement IN), cria CashMovement REFUND (dinheiro sai
   * do caixa) e rastreia refundedQuantity/refundedTotal para impedir estorno
   * duplo. Sem `items` = estorno total dos saldos restantes.
   */
  async refund(
    ctx: TenantContext,
    id: string,
    input: RefundSaleInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = this.repo(ctx);
    const sale = await repo.findById(id);
    if (!sale) throw notFound('Venda não encontrada', 'SALE_NOT_FOUND');
    if (sale.status !== 'COMPLETED') {
      throw conflict('Venda não pode ser estornada', 'SALE_NOT_REFUNDABLE');
    }

    const saleTotal = toDecimal(String(sale.total));
    const saleSubtotal = toDecimal(String(sale.subtotal));
    const alreadyRefunded = toDecimal(String(sale.refundedTotal));
    if (alreadyRefunded.gte(saleTotal)) {
      throw conflict('Venda já totalmente estornada', 'SALE_ALREADY_REFUNDED');
    }

    const itemsById = new Map(sale.items.map((it) => [it.id, it]));
    const lines: { item: (typeof sale.items)[number]; qty: Prisma.Decimal }[] = [];

    if (!input.items || input.items.length === 0) {
      // Estorno total: todos os saldos restantes por item.
      for (const it of sale.items) {
        const remaining = toDecimal(String(it.quantity)).sub(
          toDecimal(String(it.refundedQuantity)),
        );
        if (remaining.gt(0)) lines.push({ item: it, qty: remaining });
      }
      if (lines.length === 0) {
        throw conflict('Venda já totalmente estornada', 'SALE_ALREADY_REFUNDED');
      }
    } else {
      const seen = new Set<string>();
      for (const li of input.items) {
        if (seen.has(li.saleItemId)) {
          throw badRequest('Item duplicado no estorno', 'DUPLICATE_REFUND_ITEM');
        }
        seen.add(li.saleItemId);
        const item = itemsById.get(li.saleItemId);
        if (!item) throw badRequest('Item da venda inválido', 'INVALID_SALE_ITEM');
        const remaining = toDecimal(String(item.quantity)).sub(
          toDecimal(String(item.refundedQuantity)),
        );
        const qty = toDecimal(li.quantity);
        if (qty.gt(remaining)) {
          throw conflict('Quantidade acima do saldo estornável', 'REFUND_EXCEEDS_REMAINING');
        }
        lines.push({ item, qty });
      }
    }

    // Valor proporcional desta leva: item.total × (qty / item.quantity).
    let refundedSubtotal = toDecimal(0);
    for (const l of lines) {
      const itemQty = toDecimal(String(l.item.quantity));
      if (itemQty.lte(0)) continue;
      refundedSubtotal = refundedSubtotal.add(
        toDecimal(String(l.item.total)).mul(l.qty).div(itemQty),
      );
    }

    let refundAmount: Prisma.Decimal;
    if (saleSubtotal.gt(0)) {
      // Rateia o desconto da venda proporcionalmente ao estornado.
      refundAmount = saleTotal.mul(refundedSubtotal).div(saleSubtotal);
    } else {
      refundAmount = refundedSubtotal;
    }
    const remainingRefundable = saleTotal.sub(alreadyRefunded);
    if (refundAmount.gt(remainingRefundable)) refundAmount = remainingRefundable;
    refundAmount = refundAmount.toDecimalPlaces(2);
    if (refundAmount.lte(0)) throw badRequest('Nada a estornar', 'NOTHING_TO_REFUND');

    let cashSessionId = input.cashSessionId;
    if (cashSessionId) {
      await this.validateCashSession(ctx, cashSessionId, sale.storeId);
    } else {
      const open = await this.prisma.cashSession.findFirst({
        where: { tenantId: ctx.tenantId, storeId: sale.storeId, status: 'OPEN' },
        select: { id: true },
        orderBy: { openedAt: 'desc' },
      });
      if (!open) {
        throw badRequest('Nenhuma sessão de caixa aberta nesta unidade', 'CASH_SESSION_NOT_OPEN');
      }
      cashSessionId = open.id;
    }

    const methodCode = input.methodCode ?? 'CASH';
    const newRefundedTotal = alreadyRefunded.add(refundAmount);
    const balanceRepo = new StockBalanceRepository(this.prisma, ctx);

    await this.prisma.$transaction(async (tx) => {
      for (const l of lines) {
        const prevRefunded = toDecimal(String(l.item.refundedQuantity));
        await tx.saleItem.update({
          where: { id: l.item.id },
          data: { refundedQuantity: prevRefunded.add(l.qty) },
        });

        const result = await balanceRepo.applyDelta(tx, {
          storeId: sale.storeId,
          productId: l.item.productId,
          delta: l.qty,
        });
        if (result.status !== 'OK') {
          throw conflict('Não foi possível devolver o estoque', 'STOCK_APPLY_FAILED');
        }
        await tx.stockMovement.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: sale.storeId,
            productId: l.item.productId,
            type: 'IN',
            quantity: l.qty,
            balanceAfter: result.balanceAfter!,
            reason: 'Devolução por estorno de venda',
            referenceType: 'SALE',
            referenceId: id,
            createdBy: ctx.userId,
          },
        });
      }

      await tx.sale.update({
        where: { id },
        data: { refundedTotal: newRefundedTotal },
      });

      await tx.cashMovement.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: sale.storeId,
          cashSessionId,
          type: 'REFUND',
          methodCode,
          amount: refundAmount,
          notes: input.notes?.trim() || 'Estorno de venda',
          referenceType: 'SALE',
          referenceId: id,
          createdBy: ctx.userId,
        },
      });

      await new AuditService(tx).log({
        ctx,
        action: 'SALE_REFUNDED',
        entity: 'Sale',
        entityId: id,
        before: { refundedTotal: alreadyRefunded.toString() },
        after: {
          refundedTotal: newRefundedTotal.toString(),
          refundAmount: refundAmount.toString(),
          methodCode,
          cashSessionId,
          items: lines.map((l) => ({
            saleItemId: l.item.id,
            productId: l.item.productId,
            quantity: l.qty.toString(),
          })),
        },
        ip: meta?.ip,
        device: meta?.device,
      });
    });

    const updated = await repo.findById(id);
    if (!updated) throw notFound('Venda não encontrada', 'SALE_NOT_FOUND');
    return updated;
  }
}

export function saleService(prisma: PrismaClient): SaleService {
  return new SaleService(prisma);
}