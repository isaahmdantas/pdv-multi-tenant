import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { UpdateProductBrandInput } from "@/modules/products/schemas";
import { ProductBrandRepository } from "@/modules/products/repositories/catalog-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { notFound, conflict } from "@/lib/api/errors";

type CreateBrandData = { name: string };

export class ProductBrandService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext) {
    const repo = new ProductBrandRepository(this.prisma, ctx);
    const rows = await repo.list();
    return rows.map((b) => ({ id: b.id, name: b.name, status: b.status }));
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new ProductBrandRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Marca não encontrada", "PRODUCT_BRAND_NOT_FOUND");
    return row;
  }

  async create(ctx: TenantContext, input: CreateBrandData, meta?: { ip?: string; device?: string }) {
    const repo = new ProductBrandRepository(this.prisma, ctx);
    if (await repo.findByName(input.name)) {
      throw conflict("Já existe uma marca com este nome", "PRODUCT_BRAND_TAKEN");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const brand = await tx.productBrand.create({
        data: { tenantId: ctx.tenantId, name: input.name },
        select: { id: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_BRAND_CREATED",
        entity: "ProductBrand",
        entityId: brand.id,
        after: { name: brand.name },
        ip: meta?.ip,
        device: meta?.device,
      });
      return brand;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateProductBrandInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new ProductBrandRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Marca não encontrada", "PRODUCT_BRAND_NOT_FOUND");

    if (input.name && input.name !== existing.name) {
      const taken = await repo.findByName(input.name);
      if (taken) throw conflict("Já existe uma marca com este nome", "PRODUCT_BRAND_TAKEN");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const brand = await tx.productBrand.update({
        where: { id },
        data: { name: input.name ?? existing.name },
        select: { id: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_BRAND_UPDATED",
        entity: "ProductBrand",
        entityId: id,
        before: { name: existing.name },
        after: { name: brand.name },
        ip: meta?.ip,
        device: meta?.device,
      });
      return brand;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new ProductBrandRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Marca não encontrada", "PRODUCT_BRAND_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const brand = await tx.productBrand.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "PRODUCT_BRAND_DEACTIVATED",
        entity: "ProductBrand",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });
      return brand;
    });

    return updated;
  }
}