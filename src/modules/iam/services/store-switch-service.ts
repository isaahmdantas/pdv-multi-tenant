import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { AccessRepository } from "@/modules/iam/repositories/access-repository";
import {
  resolveEffectivePermissions,
  toRoleWithPermissions,
} from "@/modules/iam/services/authorization-service";
import { notFound, forbidden } from "@/lib/api/errors";

export class StoreSwitchService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Valida acesso à unidade e retorna permissões efetivas resultantes.
   * A rota HTTP (Fase 3 Auth.js) chama este método, atualiza JWT e registra AuditLog.
   */
  async authorizeSwitch(
    tenantId: string,
    userId: string,
    newStoreId: string,
  ): Promise<{ storeId: string; role: string; permissions: string[] }> {
    const ctx: TenantContext = { tenantId, userId, storeId: null, role: "NONE", permissions: [] };
    const access = new AccessRepository(this.prisma, ctx);

    const store = await access.findStore(newStoreId);
    if (!store) throw notFound("Unidade não encontrada", "STORE_NOT_FOUND");
    if (store.tenantId !== tenantId) {
      throw forbidden("Unidade não pertence ao tenant", "STORE_NOT_ALLOWED");
    }

    const userStore = await access.findUserStore(newStoreId);
    const rawGlobalRoles = await access.userGlobalRoles();
    const globalRoles = rawGlobalRoles.map(toRoleWithPermissions);
    const allowedByGlobal = globalRoles.some((r) => r.globalStoreAccess);

    if (!userStore && !allowedByGlobal) {
      throw forbidden("Acesso negado à unidade", "STORE_NOT_ALLOWED");
    }

    let storeRole: Awaited<ReturnType<AccessRepository["storeRolePermissions"]>> = null;
    if (userStore?.storeRoleId) {
      storeRole = await access.storeRolePermissions(userStore.storeRoleId);
    }

    const { role, permissions } = resolveEffectivePermissions(
      globalRoles,
      storeRole ? toRoleWithPermissions(storeRole) : null,
    );

    return { storeId: newStoreId, role, permissions };
  }
}