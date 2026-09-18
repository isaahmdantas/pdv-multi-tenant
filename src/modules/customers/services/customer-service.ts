import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/modules/customers/schemas";
import { toDecimal } from "@/lib/money";
import { CustomerRepository } from "@/modules/customers/repositories/customer-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { badRequest, conflict, notFound } from "@/lib/api/errors";

type CreateCustomerData = Omit<CreateCustomerInput, "creditLimit"> & {
  creditLimit?: string | number;
};

type UpdateCustomerData = Omit<UpdateCustomerInput, "creditLimit"> & {
  creditLimit?: string | number;
};

export class CustomerService {
  constructor(private readonly prisma: PrismaClient) {}

  private mapCustomer(row: Awaited<ReturnType<CustomerRepository["findById"]>>) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      document: row.document,
      email: row.email,
      phone: row.phone,
      birthday: row.birthday,
      notes: row.notes,
      category: row.category,
      creditLimit: row.creditLimit,
      loyaltyPoints: row.loyaltyPoints,
      status: row.status,
    };
  }

  async list(ctx: TenantContext, opts: { includeInactive?: boolean; search?: string } = {}) {
    const repo = new CustomerRepository(this.prisma, ctx);
    const rows = await repo.list(opts.includeInactive, opts.search);
    return rows.map((row) => this.mapCustomer(row)).filter((c): c is NonNullable<typeof c> => c !== null);
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new CustomerRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Cliente não encontrado", "CUSTOMER_NOT_FOUND");
    return this.mapCustomer(row);
  }

  private async validateCategory(ctx: TenantContext, categoryId?: string | null) {
    if (!categoryId) return;
    const cat = await this.prisma.customerCategory.findFirst({
      where: { tenantId: ctx.tenantId, id: categoryId, status: "ACTIVE" },
    });
    if (!cat) throw badRequest("Categoria de cliente inválida", "INVALID_CATEGORY");
  }

  async create(ctx: TenantContext, input: CreateCustomerData, meta?: { ip?: string; device?: string }) {
    const repo = new CustomerRepository(this.prisma, ctx);

    if (input.document) {
      const existing = await repo.findByDocument(input.document);
      if (existing) throw conflict("Já existe um cliente com este documento", "CUSTOMER_DOCUMENT_TAKEN");
    }
    if (input.email) {
      const existing = await repo.findByEmail(input.email);
      if (existing) throw conflict("Já existe um cliente com este e-mail", "CUSTOMER_EMAIL_TAKEN");
    }

    await this.validateCategory(ctx, input.customerCategoryId);

    const creditLimit = toDecimal(input.creditLimit ?? "0");

    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          document: input.document ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          birthday: input.birthday ?? null,
          notes: input.notes ?? null,
          customerCategoryId: input.customerCategoryId ?? null,
          creditLimit,
        },
        select: { id: true, name: true, document: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "CUSTOMER_CREATED",
        entity: "Customer",
        entityId: customer.id,
        after: { name: customer.name, document: customer.document },
        ip: meta?.ip,
        device: meta?.device,
      });

      return customer;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateCustomerData,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new CustomerRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Cliente não encontrado", "CUSTOMER_NOT_FOUND");

    if (input.document && input.document !== existing.document) {
      const taken = await repo.findByDocument(input.document);
      if (taken) throw conflict("Já existe um cliente com este documento", "CUSTOMER_DOCUMENT_TAKEN");
    }
    if (input.email && input.email !== existing.email) {
      const taken = await repo.findByEmail(input.email);
      if (taken) throw conflict("Já existe um cliente com este e-mail", "CUSTOMER_EMAIL_TAKEN");
    }

    await this.validateCategory(ctx, input.customerCategoryId);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.document !== undefined) data.document = input.document ?? null;
    if (input.email !== undefined) data.email = input.email ?? null;
    if (input.phone !== undefined) data.phone = input.phone ?? null;
    if (input.birthday !== undefined) data.birthday = input.birthday;
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.customerCategoryId !== undefined) data.customerCategoryId = input.customerCategoryId ?? null;
    if (input.creditLimit !== undefined) data.creditLimit = toDecimal(input.creditLimit);

    const updated = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data,
        select: { id: true, name: true, document: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "CUSTOMER_UPDATED",
        entity: "Customer",
        entityId: id,
        before: { name: existing.name, document: existing.document },
        after: { name: customer.name, document: customer.document },
        ip: meta?.ip,
        device: meta?.device,
      });

      return customer;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new CustomerRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Cliente não encontrado", "CUSTOMER_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, name: true, document: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "CUSTOMER_DEACTIVATED",
        entity: "Customer",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });

      return customer;
    });

    return updated;
  }
}