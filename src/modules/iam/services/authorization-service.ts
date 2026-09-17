import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { AccessRepository } from "@/modules/iam/repositories/access-repository";
import { forbidden } from "@/lib/api/errors";

export interface RoleWithPermissions {
  id: string;
  name: string;
  globalStoreAccess: boolean;
  permissions: string[];
}

export function permissionsOfRole(role: {
  rolePermissions: { permission: { code: string } }[];
}): string[] {
  return role.rolePermissions.map((rp) => rp.permission.code);
}

export function uniquePermissions(perms: string[]): string[] {
  return [...new Set(perms)];
}

export function resolveEffectivePermissions(
  globalRoles: RoleWithPermissions[],
  storeRole: RoleWithPermissions | null,
): { role: string; permissions: string[] } {
  if (storeRole) {
    return { role: storeRole.name, permissions: uniquePermissions(storeRole.permissions) };
  }
  return {
    role: globalRoles[0]?.name ?? "NONE",
    permissions: uniquePermissions(globalRoles.flatMap((r) => r.permissions)),
  };
}

export function toRoleWithPermissions(raw: {
  id: string;
  name: string;
  globalStoreAccess: boolean;
  rolePermissions: { permission: { code: string } }[];
}): RoleWithPermissions {
  return {
    id: raw.id,
    name: raw.name,
    globalStoreAccess: raw.globalStoreAccess,
    permissions: raw.rolePermissions.map((rp) => rp.permission.code),
  };
}

export class AuthorizationService {
  constructor(private readonly prisma: PrismaClient) {}

  async resolve(ctx: TenantContext): Promise<{ role: string; permissions: string[] }> {
    const access = new AccessRepository(this.prisma, ctx);
    const rawGlobalRoles = await access.userGlobalRoles();
    const globalRoles = rawGlobalRoles.map(toRoleWithPermissions);

    let storeRole: RoleWithPermissions | null = null;
    if (ctx.storeId) {
      const userStore = await access.findUserStore(ctx.storeId);
      if (userStore?.storeRoleId) {
        const rawStoreRole = await access.storeRolePermissions(userStore.storeRoleId);
        if (rawStoreRole) storeRole = toRoleWithPermissions(rawStoreRole);
      }
    }

    return resolveEffectivePermissions(globalRoles, storeRole);
  }
}

export function authorize(ctx: TenantContext | null, permission: string): asserts ctx is TenantContext {
  if (!ctx) throw forbidden("Contexto não resolvido");
  if (!ctx.permissions.includes(permission)) {
    throw forbidden(`Permissão necessária: ${permission}`);
  }
}