import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";

export class ProductCategoryRepository extends TenantScopedRepository {
  async list(includeInactive = false) {
    return this.prisma.productCategory.findMany({
      where: this.scope(includeInactive ? {} : { status: "ACTIVE" }),
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string) {
    return this.prisma.productCategory.findFirst({
      where: this.scope({ id }),
    });
  }

  async findByName(name: string) {
    return this.prisma.productCategory.findFirst({
      where: this.scope({ name }),
    });
  }
}

export class ProductBrandRepository extends TenantScopedRepository {
  async list(includeInactive = false) {
    return this.prisma.productBrand.findMany({
      where: this.scope(includeInactive ? {} : { status: "ACTIVE" }),
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string) {
    return this.prisma.productBrand.findFirst({
      where: this.scope({ id }),
    });
  }

  async findByName(name: string) {
    return this.prisma.productBrand.findFirst({
      where: this.scope({ name }),
    });
  }
}

export class UnitMeasureRepository extends TenantScopedRepository {
  async list(includeInactive = false) {
    return this.prisma.unitOfMeasure.findMany({
      where: this.scope(includeInactive ? {} : { status: "ACTIVE" }),
      orderBy: { code: "asc" },
      include: {
        conversionsFrom: {
          select: {
            id: true,
            fromUnitId: true,
            toUnitId: true,
            factor: true,
            toUnit: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.unitOfMeasure.findFirst({
      where: this.scope({ id }),
      include: {
        conversionsFrom: {
          select: {
            id: true,
            fromUnitId: true,
            toUnitId: true,
            factor: true,
            toUnit: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.unitOfMeasure.findFirst({
      where: this.scope({ code }),
    });
  }

  async findConversion(fromUnitId: string, toUnitId: string) {
    return this.prisma.unitConversion.findFirst({
      where: this.scope({ fromUnitId, toUnitId }),
    });
  }
}

export function productCategoryRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new ProductCategoryRepository(prisma, ctx);
}

export function productBrandRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new ProductBrandRepository(prisma, ctx);
}

export function unitMeasureRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new UnitMeasureRepository(prisma, ctx);
}