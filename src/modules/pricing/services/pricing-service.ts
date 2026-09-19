import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { PRICE_PRIORITY, type PriceRule } from "@/modules/pricing/constants";
import { notFound } from "@/lib/api/errors";

export interface PricingRequest {
  tenantId: string;
  storeId: string;
  productId: string;
  customerId?: string | null;
  customerCategoryId?: string | null;
  quantity?: number;
  dateTime?: Date | string;
}

export interface PricingResult {
  unitPrice: Prisma.Decimal;
  priceTableId?: string;
  promotionId?: string;
  appliedRule: PriceRule;
  displayPrice: Prisma.Decimal;
}

interface PriceCandidate {
  price: Prisma.Decimal;
  priceTableId: string;
  rule: PriceRule;
  priority: number;
  validFrom: Date;
  createdAt: Date;
}

export class PricingService {
  constructor(private readonly prisma: PrismaClient) {}

  async resolve(req: PricingRequest): Promise<PricingResult> {
    const now = req.dateTime ? new Date(req.dateTime) : new Date();
    const quantity = req.quantity && req.quantity > 0 ? req.quantity : 1;

    const product = await this.prisma.product.findFirst({
      where: { tenantId: req.tenantId, id: req.productId, status: "ACTIVE" },
      select: { id: true, basePrice: true },
    });
    if (!product) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");

    const categoryId = await this.resolveCategoryId(
      req.tenantId,
      req.storeId,
      req.customerId ?? null,
      req.customerCategoryId ?? null,
    );

    const base = await this.resolveBasePrice(
      req.tenantId,
      req.storeId,
      req.productId,
      categoryId,
      quantity,
      now,
      product.basePrice,
    );

    const promotion = await this.findBestPromotion(
      req.tenantId,
      req.storeId,
      req.productId,
      categoryId,
      now,
    );

    if (promotion) {
      const unitPrice = this.applyDiscount(
        base.price,
        promotion.discountType as "PERCENTAGE" | "FIXED",
        promotion.discountValue,
      );
      return {
        unitPrice,
        priceTableId: base.priceTableId,
        promotionId: promotion.id,
        appliedRule: "PROMOTION",
        displayPrice: unitPrice,
      };
    }

    return {
      unitPrice: base.price,
      priceTableId: base.priceTableId,
      appliedRule: base.rule,
      displayPrice: base.price,
    };
  }

  private async resolveCategoryId(
    tenantId: string,
    storeId: string,
    customerId: string | null,
    customerCategoryId: string | null,
  ): Promise<string | null> {
    if (customerCategoryId) return customerCategoryId;

    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { tenantId, id: customerId, status: "ACTIVE" },
        select: { customerCategoryId: true },
      });
      if (customer?.customerCategoryId) return customer.customerCategoryId;
    }

    const store = await this.prisma.store.findFirst({
      where: { tenantId, id: storeId },
      select: { defaultCustomerCategoryId: true },
    });
    if (store?.defaultCustomerCategoryId) return store.defaultCustomerCategoryId;

    const isDefault = await this.prisma.customerCategory.findFirst({
      where: { tenantId, isDefault: true, status: "ACTIVE" },
      select: { id: true },
    });
    return isDefault?.id ?? null;
  }

  private async resolveBasePrice(
    tenantId: string,
    storeId: string,
    productId: string,
    categoryId: string | null,
    quantity: number,
    now: Date,
    fallback: Prisma.Decimal,
  ): Promise<{ price: Prisma.Decimal; priceTableId?: string; rule: PriceRule }> {
    const candidates = await this.prisma.priceTable.findMany({
      where: {
        tenantId,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        AND: [
          { OR: [{ storeId: null }, { storeId }] },
          categoryId
            ? { OR: [{ customerCategoryId: null }, { customerCategoryId: categoryId }] }
            : { customerCategoryId: null },
        ],
      },
      include: {
        productPrices: {
          where: {
            productId,
            ...quantityClause(quantity),
          },
        },
      },
    });

    const scored: PriceCandidate[] = [];
    for (const table of candidates) {
      const storeBound = table.storeId === storeId;
      const catBound = table.customerCategoryId === categoryId;

      if (storeBound && catBound) {
        const row = pickRow(table.productPrices);
        scored.push({
          price: row ? row.unitPrice : table.defaultPrice,
          priceTableId: table.id,
          rule: row ? "PRODUCT_CATEGORY_PRICE" : "CATEGORY_DEFAULT_PRICE",
          priority: table.priority,
          validFrom: table.validFrom,
          createdAt: table.createdAt,
        });
      } else if (storeBound) {
        const row = pickRow(table.productPrices);
        scored.push({
          price: row ? row.unitPrice : table.defaultPrice,
          priceTableId: table.id,
          rule: "STORE_PRICE",
          priority: table.priority,
          validFrom: table.validFrom,
          createdAt: table.createdAt,
        });
      } else if (catBound) {
        const row = pickRow(table.productPrices);
        scored.push({
          price: row ? row.unitPrice : table.defaultPrice,
          priceTableId: table.id,
          rule: "CATEGORY_PRICE",
          priority: table.priority,
          validFrom: table.validFrom,
          createdAt: table.createdAt,
        });
      }
    }

    if (scored.length === 0) {
      return { price: fallback, rule: "PRODUCT_BASE_PRICE" };
    }

    scored.sort(
      (a, b) =>
        PRICE_PRIORITY[a.rule] - PRICE_PRIORITY[b.rule] ||
        b.priority - a.priority ||
        b.validFrom.getTime() - a.validFrom.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const winner = scored[0];
    return { price: winner.price, priceTableId: winner.priceTableId, rule: winner.rule };
  }

  private async findBestPromotion(
    tenantId: string,
    storeId: string,
    productId: string,
    categoryId: string | null,
    now: Date,
  ) {
    const promotions = await this.prisma.promotion.findMany({
      where: {
        tenantId,
        active: true,
        validFrom: { lte: now },
        AND: [
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
          categoryId
            ? { OR: [{ customerCategoryId: null }, { customerCategoryId: categoryId }] }
            : { customerCategoryId: null },
          { OR: [{ storeId: null }, { storeId }] },
          { OR: [{ productId: null }, { productId }] },
        ],
      },
    });

    promotions.sort(
      (a, b) =>
        specificity(b) - specificity(a) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return promotions[0] ?? null;
  }

  private applyDiscount(
    base: Prisma.Decimal,
    discountType: "PERCENTAGE" | "FIXED",
    discountValue: Prisma.Decimal,
  ): Prisma.Decimal {
    if (discountType === "PERCENTAGE") {
      const factor = new Prisma.Decimal(1).minus(
        new Prisma.Decimal(discountValue.toString()).div(100),
      );
      return base.times(factor);
    }
    const result = base.minus(new Prisma.Decimal(discountValue.toString()));
    return result.isNegative() ? new Prisma.Decimal(0) : result;
  }
}

function quantityClause(q: number) {
  return {
    AND: [
      { OR: [{ minimumQuantity: null }, { minimumQuantity: { lte: q } }] },
      { OR: [{ maximumQuantity: null }, { maximumQuantity: { gte: q } }] },
    ],
  };
}

function pickRow(rows: Array<{ unitPrice: Prisma.Decimal; minimumQuantity: Prisma.Decimal | null; createdAt: Date }>) {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => {
    const bestMin = best.minimumQuantity ?? new Prisma.Decimal(-1);
    const rowMin = row.minimumQuantity ?? new Prisma.Decimal(-1);
    if (rowMin.gt(bestMin)) return row;
    if (rowMin.eq(bestMin) && new Date(row.createdAt).getTime() > new Date(best.createdAt).getTime()) {
      return row;
    }
    return best;
  });
}

function specificity(p: { storeId: string | null; productId: string | null; customerCategoryId: string | null }) {
  return (
    (p.productId !== null ? 4 : 0) +
    (p.customerCategoryId !== null ? 2 : 0) +
    (p.storeId !== null ? 1 : 0)
  );
}