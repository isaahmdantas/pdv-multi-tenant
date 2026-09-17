import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { UpdateProductCategoryInput } from "@/modules/products/schemas";
import { ProductCategoryRepository } from "@/modules/products/repositories/catalog-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { notFound, conflict } from "@/lib/api/errors";

type CreateCategoryData = { name: string };

export class ProductCategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext) {
    const repo = new ProductCategoryRepository(this.prisma, ctx);
    const rows = await repo.list();
    return rows.map((c) => ({ id: c.id, name: c.name, status: c.status }));
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new ProductCategoryRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Categoria não encontrada", "PRODUCT_CATEGORY_NOT_FOUND");
    return row;
  }

  async create(ctx: TenantContext, input: CreateCategoryData, meta?: { ip?: string; device?: string }) {
    const repo = new ProductCategoryRepository(this.prisma, ctx);
    if (await repo.findByName(input.name)) {
      throw conflict("Já existe uma categoria com este nome", "PRODUCT_CATEGORY_TAKEN");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const category = await tx.productCategory.create({
        data: { tenantId: ctx.tenantId, name: input.name },
        select: { id: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_CATEGORY_CREATED",
        entity: "ProductCategory",
        entityId: category.id,
        after: { name: category.name },
        ip: meta?.ip,
        device: meta?.device,
      });
      return category;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateProductCategoryInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new ProductCategoryRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Categoria não encontrada", "PRODUCT_CATEGORY_NOT_FOUND");

    if (input.name && input.name !== existing.name) {
      const taken = await repo.findByName(input.name);
      if (taken) throw conflict("Já existe uma categoria com este nome", "PRODUCT_CATEGORY_TAKEN");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const category = await tx.productCategory.update({
        where: { id },
        data: { name: input.name ?? existing.name },
        select: { id: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_CATEGORY_UPDATED",
        entity: "ProductCategory",
        entityId: id,
        before: { name: existing.name },
        after: { name: category.name },
        ip: meta?.ip,
        device: meta?.device,
      });
      return category;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new ProductCategoryRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Categoria não encontrada", "PRODUCT_CATEGORY_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const category = await tx.productCategory.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_CATEGORY_DEACTIVATED",
        entity: "ProductCategory",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });
      return category;
    });

    return updated;
  }
}