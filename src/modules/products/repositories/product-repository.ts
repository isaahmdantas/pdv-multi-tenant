import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";

const productInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  baseUnit: { select: { id: true, code: true, name: true } },
  barcodes: { select: { id: true, value: true } },
} as const;

export class ProductRepository extends TenantScopedRepository {
  private storeLinkWhere() {
    return { storeId: this.ctx.storeId ?? "__none__" };
  }

  async list(includeInactive = false) {
    return this.prisma.product.findMany({
      where: this.scope(includeInactive ? {} : { status: "ACTIVE" }),
      orderBy: { name: "asc" },
      include: {
        ...productInclude,
        storeLinks: {
          where: this.storeLinkWhere(),
          select: { id: true, status: true },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.product.findFirst({
      where: this.scope({ id }),
      include: {
        ...productInclude,
        storeLinks: {
          where: this.storeLinkWhere(),
          select: { id: true, status: true },
        },
      },
    });
  }

  async findBySku(sku: string) {
    return this.prisma.product.findFirst({
      where: this.scope({ sku }),
      select: { id: true, name: true, sku: true },
    });
  }

  async findByBarcode(value: string) {
    const barcode = await this.prisma.productBarcode.findFirst({
      where: this.scope({ value }),
      include: {
        product: {
          include: {
            ...productInclude,
            storeLinks: {
              where: this.storeLinkWhere(),
              select: { id: true, status: true },
            },
          },
        },
      },
    });
    return barcode?.product ?? null;
  }

  async barcodeValuesExist(values: string[], excludeProductId?: string) {
    const found = await this.prisma.productBarcode.findMany({
      where: this.scope({
        value: { in: values },
        ...(excludeProductId ? { productId: { not: excludeProductId } } : {}),
      }),
      select: { value: true },
    });
    return found.map((b) => b.value);
  }

  async storeLink(storeId: string, productId: string) {
    return this.prisma.productStore.findFirst({
      where: this.scope({ storeId, productId }),
    });
  }
}

export function productRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new ProductRepository(prisma, ctx);
}