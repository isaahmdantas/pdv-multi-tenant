import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type {
  UpdateCustomerCategoryInput,
} from "@/modules/customers/schemas";
import { CustomerCategoryRepository } from "@/modules/customers/repositories/customer-category-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import type { AuditTransactionClient } from "@/modules/audit/types";
import { notFound, conflict } from "@/lib/api/errors";

type CreateCustomerCategoryData = {
  name: string;
  isDefault?: boolean;
};

export class CustomerCategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext) {
    const repo = new CustomerCategoryRepository(this.prisma, ctx);
    const rows = await repo.list();
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      isDefault: c.isDefault,
      status: c.status,
    }));
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new CustomerCategoryRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Categoria de cliente não encontrada", "CUSTOMER_CATEGORY_NOT_FOUND");
    return row;
  }

  private async unsetOthers(prisma: AuditTransactionClient, tenantId: string, exceptId: string) {
    await prisma.customerCategory.updateMany({
      where: { tenantId, isDefault: true, id: { not: exceptId } },
      data: { isDefault: false },
    });
  }

  async create(
    ctx: TenantContext,
    input: CreateCustomerCategoryData,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new CustomerCategoryRepository(this.prisma, ctx);
    const isDefault = input.isDefault ?? false;

    if (await repo.findByName(input.name)) {
      throw conflict("Já existe uma categoria com este nome", "CUSTOMER_CATEGORY_TAKEN");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await this.unsetOthers(tx, ctx.tenantId, "__none__");
      }
      const category = await tx.customerCategory.create({
        data: { tenantId: ctx.tenantId, name: input.name, isDefault },
        select: { id: true, name: true, isDefault: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "CUSTOMER_CATEGORY_CREATED",
        entity: "CustomerCategory",
        entityId: category.id,
        after: { name: category.name, isDefault: category.isDefault },
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
    input: UpdateCustomerCategoryInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new CustomerCategoryRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Categoria de cliente não encontrada", "CUSTOMER_CATEGORY_NOT_FOUND");

    if (input.name && input.name !== existing.name) {
      const taken = await repo.findByName(input.name);
      if (taken) throw conflict("Já existe uma categoria com este nome", "CUSTOMER_CATEGORY_TAKEN");
    }

    const isDefault = input.isDefault ?? existing.isDefault;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await this.unsetOthers(tx, ctx.tenantId, id);
      }
      const category = await tx.customerCategory.update({
        where: { id },
        data: {
          name: input.name ?? existing.name,
          isDefault,
        },
        select: { id: true, name: true, isDefault: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "CUSTOMER_CATEGORY_UPDATED",
        entity: "CustomerCategory",
        entityId: id,
        before: { name: existing.name, isDefault: existing.isDefault },
        after: { name: category.name, isDefault: category.isDefault },
        ip: meta?.ip,
        device: meta?.device,
      });
      return category;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new CustomerCategoryRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Categoria de cliente não encontrada", "CUSTOMER_CATEGORY_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const category = await tx.customerCategory.update({
        where: { id },
        data: { status: "INACTIVE", isDefault: false },
        select: { id: true, name: true, isDefault: true, status: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "CUSTOMER_CATEGORY_DEACTIVATED",
        entity: "CustomerCategory",
        entityId: id,
        before: { status: existing.status, isDefault: existing.isDefault },
        after: { status: "INACTIVE", isDefault: false },
        ip: meta?.ip,
        device: meta?.device,
      });
      return category;
    });

    return updated;
  }
}