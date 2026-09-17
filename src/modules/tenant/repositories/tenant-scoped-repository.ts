import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export abstract class TenantScopedRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly ctx: TenantContext,
  ) {}

  protected scope<T extends Record<string, unknown>>(where: T): T & { tenantId: string } {
    return { ...where, tenantId: this.ctx.tenantId };
  }

  protected scopeStore<T extends Record<string, unknown>>(
    where: T,
  ): T & { tenantId: string; storeId: string | null } {
    return { ...where, tenantId: this.ctx.tenantId, storeId: this.ctx.storeId };
  }
}