import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type {
  CreateProductInput,
  UpdateProductInput,
  UpdateProductStoreInput,
} from "@/modules/products/schemas";
import { toDecimal } from "@/modules/products/schemas";
import { ProductRepository } from "@/modules/products/repositories/product-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { badRequest, conflict, notFound } from "@/lib/api/errors";

type CreateProductData = Omit<CreateProductInput, "basePrice" | "isService"> & {
  basePrice?: string | number;
  isService?: boolean;
};

type UpdateProductData = Omit<UpdateProductInput, "basePrice" | "isService"> & {
  basePrice?: string | number;
  isService?: boolean;
};

export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  private mapProduct(row: Awaited<ReturnType<ProductRepository["findById"]>>) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      description: row.description,
      category: row.category,
      brand: row.brand,
      baseUnit: row.baseUnit,
      basePrice: row.basePrice,
      status: row.status,
      barcodes: row.barcodes,
      fiscal: {
        ncm: row.ncm,
        cest: row.cest,
        cfop: row.cfop,
        isService: row.isService,
      },
      availableInStore: row.storeLinks.every((l) => l.status !== "INACTIVE"),
    };
  }

  async list(ctx: TenantContext) {
    const repo = new ProductRepository(this.prisma, ctx);
    const rows = await repo.list();
    return rows.map((row) => this.mapProduct(row)).filter((p): p is NonNullable<typeof p> => p !== null);
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new ProductRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");
    return this.mapProduct(row);
  }

  async findByBarcode(ctx: TenantContext, value: string) {
    const repo = new ProductRepository(this.prisma, ctx);
    const row = await repo.findByBarcode(value);
    if (!row) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");
    return this.mapProduct(row);
  }

  private async validateReferences(ctx: TenantContext, refs: {
    categoryId?: string | null;
    brandId?: string | null;
    baseUnitId?: string | null;
  }) {
    if (refs.categoryId) {
      const cat = await this.prisma.productCategory.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.categoryId },
      });
      if (!cat) throw badRequest("Categoria inválida", "INVALID_CATEGORY");
    }
    if (refs.brandId) {
      const brand = await this.prisma.productBrand.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.brandId },
      });
      if (!brand) throw badRequest("Marca inválida", "INVALID_BRAND");
    }
    if (refs.baseUnitId) {
      const unit = await this.prisma.unitOfMeasure.findFirst({
        where: { tenantId: ctx.tenantId, id: refs.baseUnitId },
      });
      if (!unit) throw badRequest("Unidade de medida inválida", "INVALID_BASE_UNIT");
    }
  }

  private async assertBarcodesFree(ctx: TenantContext, values: string[], excludeProductId?: string) {
    const repo = new ProductRepository(this.prisma, ctx);
    const taken = await repo.barcodeValuesExist(values, excludeProductId);
    if (taken.length > 0) {
      throw conflict(
        `Código de barras já cadastrado: ${taken.join(", ")}`,
        "BARCODE_TAKEN",
      );
    }
  }

  async create(ctx: TenantContext, input: CreateProductData, meta?: { ip?: string; device?: string }) {
    const repo = new ProductRepository(this.prisma, ctx);

    const existing = await repo.findBySku(input.sku);
    if (existing) throw conflict("Já existe um produto com este SKU", "PRODUCT_TAKEN");

    await this.validateReferences(ctx, {
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      baseUnitId: input.baseUnitId,
    });

    const barcodes = input.barcodes ?? [];
    if (barcodes.length > 0) {
      await this.assertBarcodesFree(ctx, barcodes);
    }

    const basePrice = toDecimal(input.basePrice ?? "0");

    const created = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          sku: input.sku,
          description: input.description ?? null,
          categoryId: input.categoryId ?? null,
          brandId: input.brandId ?? null,
          baseUnitId: input.baseUnitId,
          basePrice,
          ncm: input.ncm ?? null,
          cest: input.cest ?? null,
          cfop: input.cfop ?? null,
          isService: input.isService ?? false,
        },
        select: { id: true, name: true, sku: true },
      });

      if (barcodes.length > 0) {
        await tx.productBarcode.createMany({
          data: barcodes.map((value) => ({
            tenantId: ctx.tenantId,
            productId: product.id,
            value,
          })),
        });
      }

      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_CREATED",
        entity: "Product",
        entityId: product.id,
        after: { name: product.name, sku: product.sku, basePrice },
        ip: meta?.ip,
        device: meta?.device,
      });

      return product;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateProductData,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new ProductRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");

    if (input.sku && input.sku !== existing.sku) {
      const taken = await repo.findBySku(input.sku);
      if (taken) throw conflict("Já existe um produto com este SKU", "PRODUCT_TAKEN");
    }

    await this.validateReferences(ctx, {
      categoryId: input.categoryId,
      brandId: input.brandId,
      baseUnitId: input.baseUnitId,
    });

    const barcodes = input.barcodes;
    if (barcodes && barcodes.length > 0) {
      await this.assertBarcodesFree(ctx, barcodes, id);
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.sku !== undefined) data.sku = input.sku;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId ?? null;
    if (input.brandId !== undefined) data.brandId = input.brandId ?? null;
    if (input.baseUnitId !== undefined) data.baseUnitId = input.baseUnitId;
    if (input.basePrice !== undefined) data.basePrice = toDecimal(input.basePrice);
    if (input.ncm !== undefined) data.ncm = input.ncm ?? null;
    if (input.cest !== undefined) data.cest = input.cest ?? null;
    if (input.cfop !== undefined) data.cfop = input.cfop ?? null;
    if (input.isService !== undefined) data.isService = input.isService;

    const updated = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data,
        select: { id: true, name: true, sku: true, basePrice: true },
      });

      if (barcodes !== undefined) {
        await tx.productBarcode.deleteMany({ where: { productId: id } });
        if (barcodes) {
          await tx.productBarcode.createMany({
            data: barcodes.map((value) => ({
              tenantId: ctx.tenantId,
              productId: id,
              value,
            })),
          });
        }
      }

      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_UPDATED",
        entity: "Product",
        entityId: id,
        before: { name: existing.name, sku: existing.sku },
        after: { name: product.name, sku: product.sku },
        ip: meta?.ip,
        device: meta?.device,
      });

      return product;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new ProductRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, name: true, sku: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_DEACTIVATED",
        entity: "Product",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });

      return product;
    });

    return updated;
  }

  async setStoreStatus(
    ctx: TenantContext,
    productId: string,
    storeId: string,
    status: UpdateProductStoreInput["status"],
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new ProductRepository(this.prisma, ctx);

    const product = await repo.findById(productId);
    if (!product) throw notFound("Produto não encontrado", "PRODUCT_NOT_FOUND");

    const store = await this.prisma.store.findFirst({
      where: { tenantId: ctx.tenantId, id: storeId },
    });
    if (!store) throw notFound("Unidade não encontrada", "STORE_NOT_FOUND");

    const existing = await repo.storeLink(storeId, productId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const link = await tx.productStore.upsert({
        where: { tenantId_storeId_productId: { tenantId: ctx.tenantId, storeId, productId } },
        create: {
          tenantId: ctx.tenantId,
          storeId,
          productId,
          status,
        },
        update: { status },
        select: { id: true, storeId: true, productId: true, status: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_STORE_UPDATED",
        entity: "ProductStore",
        entityId: link.id,
        before: existing ? { productId, storeId, status: existing.status } : { productId, storeId, status: null },
        after: { productId, storeId, status },
        ip: meta?.ip,
        device: meta?.device,
      });

      return link;
    });

    return updated;
  }
}