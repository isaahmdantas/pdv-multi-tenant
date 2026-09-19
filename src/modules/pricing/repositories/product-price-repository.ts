import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export const productPriceInclude = {
  product: { select: { id: true, name: true, sku: true } },
  priceTable: { select: { id: true, name: true } },
} as const;

export class ProductPriceRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  listByTable(priceTableId: string) {
    return this.prisma.productPrice.findMany({
      where: { ...this.scope({ priceTableId }) },
      orderBy: [{ minimumQuantity: "asc" }, { createdAt: "asc" }],
      include: productPriceInclude,
    });
  }

  listByProduct(productId: string) {
    return this.prisma.productPrice.findMany({
      where: { ...this.scope({ productId }) },
      include: productPriceInclude,
    });
  }

  findById(id: string) {
    return this.prisma.productPrice.findFirst({
      where: { ...this.scope({ id }) },
      include: productPriceInclude,
    });
  }
}

export function productPriceRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new ProductPriceRepository(prisma, ctx);
}