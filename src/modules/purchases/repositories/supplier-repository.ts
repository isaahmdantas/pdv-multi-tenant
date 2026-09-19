import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export class SupplierRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(includeInactive = false, search?: string) {
    return this.prisma.supplier.findMany({
      where: {
        ...this.scope({}),
        status: includeInactive ? undefined : "ACTIVE",
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { document: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.supplier.findFirst({
      where: { ...this.scope({ id }) },
    });
  }

  findByDocument(document: string) {
    return this.prisma.supplier.findFirst({
      where: { ...this.scope({ document }) },
      select: { id: true, document: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.supplier.findFirst({
      where: { ...this.scope({ email }) },
      select: { id: true, email: true },
    });
  }
}

export function supplierRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new SupplierRepository(prisma, ctx);
}