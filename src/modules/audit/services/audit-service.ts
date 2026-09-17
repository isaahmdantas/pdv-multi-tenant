import type { PrismaClient } from "@/generated/prisma/client";
import type { AuditTransactionClient } from "@/modules/audit/types";
import { AuditLogRepository } from "@/modules/audit/repositories/audit-log-repository";
import type { LogOptions } from "@/modules/audit/repositories/audit-log-repository";

export class AuditService {
  constructor(private readonly tx: PrismaClient | AuditTransactionClient) {}

  async log(opts: LogOptions) {
    const repo = new AuditLogRepository(this.tx, opts.ctx);
    return repo.create(opts);
  }
}