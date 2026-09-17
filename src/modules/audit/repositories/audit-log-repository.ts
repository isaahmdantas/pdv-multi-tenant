import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { AuditAction, AuditTransactionClient } from "@/modules/audit/types";

export interface LogOptions {
  ctx: TenantContext;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  device?: string;
}

export class AuditLogRepository {
  constructor(
    readonly tx: PrismaClient | AuditTransactionClient,
    private readonly ctx: TenantContext,
  ) {}

  async create(data: Omit<LogOptions, "ctx">) {
    return this.tx.auditLog.create({
      data: {
        tenantId: this.ctx.tenantId,
        storeId: this.ctx.storeId,
        userId: this.ctx.userId,
        action: data.action,
        entity: data.entity ?? null,
        entityId: data.entityId ?? null,
        before: data.before ? JSON.parse(JSON.stringify(data.before)) : null,
        after: data.after ? JSON.parse(JSON.stringify(data.after)) : null,
        ip: data.ip ?? null,
        device: data.device ?? null,
      },
    });
  }
}