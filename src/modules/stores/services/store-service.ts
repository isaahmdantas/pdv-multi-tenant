import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { CreateStoreInput, UpdateStoreInput } from "@/modules/stores/schemas";
import { StoreRepository } from "@/modules/stores/repositories/store-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { conflict, notFound } from "@/lib/api/errors";

type CreateStoreData = Omit<CreateStoreInput, "timezone" | "fiscalEnabled"> & {
  timezone?: string;
  fiscalEnabled?: boolean;
};

const EDITABLE_FIELDS = [
  "name",
  "code",
  "document",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "zipCode",
  "timezone",
  "fiscalState",
  "fiscalEnvironment",
  "fiscalEnabled",
  "fiscalSeries",
] as const;

export class StoreService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext) {
    const repo = new StoreRepository(this.prisma, ctx);
    const stores = await repo.list();
    return stores.map((s) => ({ id: s.id, name: s.name, code: s.code, status: s.status }));
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new StoreRepository(this.prisma, ctx);
    const store = await repo.findById(id);
    if (!store) throw notFound("Unidade não encontrada", "STORE_NOT_FOUND");
    return store;
  }

  async create(ctx: TenantContext, input: CreateStoreData, meta?: { ip?: string; device?: string }) {
    const repo = new StoreRepository(this.prisma, ctx);

    if (await repo.findByCode(input.code)) {
      throw conflict("Já existe uma unidade com este código", "STORE_TAKEN");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          code: input.code,
          document: input.document ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          zipCode: input.zipCode ?? null,
          timezone: input.timezone ?? "America/Sao_Paulo",
          fiscalState: input.fiscalState ?? null,
          fiscalEnvironment: input.fiscalEnvironment ?? null,
          fiscalEnabled: input.fiscalEnabled ?? false,
          fiscalSeries: input.fiscalSeries ?? null,
        },
        select: { id: true, tenantId: true, name: true, code: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "STORE_CREATED",
        entity: "Store",
        entityId: store.id,
        after: { name: store.name, code: store.code },
        ip: meta?.ip,
        device: meta?.device,
      });

      return store;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateStoreInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new StoreRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Unidade não encontrada", "STORE_NOT_FOUND");

    if (input.code && input.code !== existing.code) {
      const taken = await repo.findByCode(input.code);
      if (taken) throw conflict("Já existe uma unidade com este código", "STORE_TAKEN");
    }

    const data: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in input) data[field] = input[field] ?? null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.update({
        where: { id },
        data,
        select: { id: true, tenantId: true, name: true, code: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "STORE_UPDATED",
        entity: "Store",
        entityId: store.id,
        before: { name: existing.name, code: existing.code },
        after: { name: store.name, code: store.code },
        ip: meta?.ip,
        device: meta?.device,
      });

      return store;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new StoreRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Unidade não encontrada", "STORE_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, tenantId: true, name: true, code: true, status: true },
      });

      await new AuditService(tx).log({
        ctx,
        action: "STORE_DEACTIVATED",
        entity: "Store",
        entityId: store.id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });

      return store;
    });

    return updated;
  }
}