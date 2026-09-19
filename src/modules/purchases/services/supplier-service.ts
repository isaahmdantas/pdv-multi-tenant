import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { CreateSupplierInput } from "@/modules/purchases/schemas";
import { SupplierRepository } from "@/modules/purchases/repositories/supplier-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { conflict, notFound } from "@/lib/api/errors";

export class SupplierService {
  constructor(private readonly prisma: PrismaClient) {}

  private repo(ctx: TenantContext) {
    return new SupplierRepository(this.prisma, ctx);
  }

  async list(ctx: TenantContext, opts: { includeInactive?: boolean; search?: string } = {}) {
    return this.repo(ctx).list(opts.includeInactive, opts.search);
  }

  async get(ctx: TenantContext, id: string) {
    const row = await this.repo(ctx).findById(id);
    if (!row) throw notFound("Fornecedor não encontrado", "SUPPLIER_NOT_FOUND");
    return row;
  }

  private async validateDocument(ctx: TenantContext, document?: string | null, excludeId?: string) {
    if (!document) return;
    const repo = this.repo(ctx);
    const existing = await repo.findByDocument(document);
    if (existing && existing.id !== excludeId) {
      throw conflict("Já existe um fornecedor com este documento", "SUPPLIER_DOCUMENT_TAKEN");
    }
  }

  private async validateEmail(ctx: TenantContext, email?: string | null, excludeId?: string) {
    if (!email) return;
    const repo = this.repo(ctx);
    const existing = await repo.findByEmail(email);
    if (existing && existing.id !== excludeId) {
      throw conflict("Já existe um fornecedor com este e-mail", "SUPPLIER_EMAIL_TAKEN");
    }
  }

  async create(ctx: TenantContext, input: CreateSupplierInput, meta?: { ip?: string; device?: string }) {
    await this.validateDocument(ctx, input.document);

    const created = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          document: input.document ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          zipCode: input.zipCode ?? null,
          notes: input.notes ?? null,
        },
      });

      await new AuditService(tx).log({
        ctx,
        action: "SUPPLIER_CREATED",
        entity: "Supplier",
        entityId: supplier.id,
        after: { name: supplier.name, document: supplier.document },
        ip: meta?.ip,
        device: meta?.device,
      });

      return supplier;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: Partial<CreateSupplierInput>,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = this.repo(ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Fornecedor não encontrado", "SUPPLIER_NOT_FOUND");

    await this.validateDocument(ctx, input.document, id);
    await this.validateEmail(ctx, input.email, id);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.document !== undefined) data.document = input.document ?? null;
    if (input.email !== undefined) data.email = input.email ?? null;
    if (input.phone !== undefined) data.phone = input.phone ?? null;
    if (input.address !== undefined) data.address = input.address ?? null;
    if (input.city !== undefined) data.city = input.city ?? null;
    if (input.state !== undefined) data.state = input.state ?? null;
    if (input.zipCode !== undefined) data.zipCode = input.zipCode ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { id },
        data,
      });

      await new AuditService(tx).log({
        ctx,
        action: "SUPPLIER_UPDATED",
        entity: "Supplier",
        entityId: id,
        before: { name: existing.name, document: existing.document },
        after: { name: supplier.name, document: supplier.document },
        ip: meta?.ip,
        device: meta?.device,
      });

      return supplier;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = this.repo(ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Fornecedor não encontrado", "SUPPLIER_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { id },
        data: { status: "INACTIVE" },
      });

      await new AuditService(tx).log({
        ctx,
        action: "SUPPLIER_DEACTIVATED",
        entity: "Supplier",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });

      return supplier;
    });

    return updated;
  }
}