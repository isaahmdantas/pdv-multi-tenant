import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { AuditTransactionClient } from "@/modules/audit/types";

export type ApplyDeltaStatus = "OK" | "INSUFFICIENT" | "VERSION_CONFLICT";

export interface ApplyDeltaResult {
  status: ApplyDeltaStatus;
  id?: string;
  balanceAfter?: Prisma.Decimal;
  version?: number;
}

export class StockBalanceRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  findBalance(storeId: string, productId: string) {
    return this.prisma.stockBalance.findFirst({
      where: { ...this.scope({}), storeId, productId },
    });
  }

  async applyDelta(
    tx: AuditTransactionClient,
    params: {
      storeId: string;
      productId: string;
      delta: Prisma.Decimal;
      expectedVersion?: number;
    },
  ): Promise<ApplyDeltaResult> {
    const { storeId, productId, delta, expectedVersion } = params;
    const owned = { tenantId: this.ctx.tenantId, storeId, productId };

    if (!delta.isNegative()) {
      const updated = await tx.stockBalance.upsert({
        where: { tenantId_storeId_productId: owned },
        create: { ...owned, quantity: delta, availableQuantity: delta, version: 1 },
        update: {
          quantity: { increment: delta },
          availableQuantity: { increment: delta },
          version: { increment: 1 },
        },
      });
      return { status: "OK", id: updated.id, balanceAfter: updated.quantity, version: updated.version };
    }

    const current = await tx.stockBalance.findFirst({
      where: owned,
      select: { id: true, quantity: true, version: true },
    });
    if (!current) return { status: "INSUFFICIENT" };

    const guard: Prisma.StockBalanceWhereInput = {
      id: current.id,
      quantity: { gte: delta.negated() },
      ...(expectedVersion !== undefined ? { version: expectedVersion } : {}),
    };
    const result = await tx.stockBalance.updateMany({
      where: guard,
      data: {
        quantity: { increment: delta },
        availableQuantity: { increment: delta },
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      const fresh = await tx.stockBalance.findUnique({
        where: { id: current.id },
        select: { version: true },
      });
      if (expectedVersion !== undefined && fresh && fresh.version !== expectedVersion) {
        return { status: "VERSION_CONFLICT" };
      }
      return { status: "INSUFFICIENT" };
    }
    return {
      status: "OK",
      id: current.id,
      balanceAfter: current.quantity.add(delta),
      version: current.version + 1,
    };
  }
}

export function stockBalanceRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new StockBalanceRepository(prisma, ctx);
}