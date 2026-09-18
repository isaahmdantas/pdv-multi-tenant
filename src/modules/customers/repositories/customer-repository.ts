import type { PrismaClient } from "@/generated/prisma/client";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

export const customerInclude = {
  category: { select: { id: true, name: true, isDefault: true } },
} as const;

export class CustomerRepository extends TenantScopedRepository {
  constructor(prisma: PrismaClient, ctx: TenantContext) {
    super(prisma, ctx);
  }

  list(includeInactive = false, search?: string) {
    return this.prisma.customer.findMany({
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
      include: customerInclude,
    });
  }

  findById(id: string) {
    return this.prisma.customer.findFirst({
      where: { ...this.scope({ id }) },
      include: customerInclude,
    });
  }

  findByDocument(document: string) {
    return this.prisma.customer.findFirst({
      where: { ...this.scope({ document }) },
      select: { id: true, document: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.customer.findFirst({
      where: { ...this.scope({ email }) },
      select: { id: true, email: true },
    });
  }
}

export function customerRepository(prisma: PrismaClient, ctx: TenantContext) {
  return new CustomerRepository(prisma, ctx);
}