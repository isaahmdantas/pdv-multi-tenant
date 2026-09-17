import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type { LoginInput } from "@/modules/iam/schemas";
import { PasswordService } from "@/modules/iam/password";
import { AccessRepository } from "@/modules/iam/repositories/access-repository";
import {
  toRoleWithPermissions,
  resolveEffectivePermissions,
} from "@/modules/iam/services/authorization-service";
import { AuditService } from "@/modules/audit/services/audit-service";
import { unauthorized, forbidden, badRequest } from "@/lib/api/errors";

export interface LoginResult {
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  storeId: string | null;
  role: string;
  permissions: string[];
}

/**
 * F3-02: autenticação por email/senha (argon2). Resolve o contexto inicial
 * (unidade padrão + permissões efetivas) e grava AuditLog LOGIN.
 */
export class AuthenticationService {
  constructor(private readonly prisma: PrismaClient) {}

  async login(
    input: LoginInput & { ip?: string; device?: string },
  ): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();

    let tenantIdHint: string | undefined;
    if (input.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: input.tenantSlug },
      });
      if (!tenant || tenant.status !== "ACTIVE") {
        throw unauthorized("Credenciais inválidas", "INVALID_CREDENTIALS");
      }
      tenantIdHint = tenant.id;
    }

    const candidates = await this.prisma.user.findMany({
      where: { email, ...(tenantIdHint ? { tenantId: tenantIdHint } : {}) },
    });

    if (candidates.length === 0) {
      throw unauthorized("Credenciais inválidas", "INVALID_CREDENTIALS");
    }

    let user = candidates[0]!;
    if (!tenantIdHint) {
      const active = candidates.filter((u) => u.status === "ACTIVE");
      if (active.length === 0) {
        throw forbidden("Usuário inativo", "INACTIVE_USER");
      }
      if (active.length > 1) {
        throw badRequest("Informe o slug do tenant", "MULTIPLE_TENANTS");
      }
      user = active[0]!;
    } else if (user.status !== "ACTIVE") {
      throw forbidden("Usuário inativo", "INACTIVE_USER");
    }

    const passwordOk = await PasswordService.verify(user.passwordHash, input.password);
    if (!passwordOk) {
      throw unauthorized("Credenciais inválidas", "INVALID_CREDENTIALS");
    }

    const ctx: TenantContext = {
      tenantId: user.tenantId,
      userId: user.id,
      storeId: null,
      role: "NONE",
      permissions: [],
    };
    const access = new AccessRepository(this.prisma, ctx);
    const globalRoles = (await access.userGlobalRoles()).map(toRoleWithPermissions);

    // Unidade inicial: a primeira UserStore do usuário (ordem de criação).
    const userStores = await access.userStores();
    const initialStore = userStores[0] ?? null;
    let storeId: string | null = null;
    let storeRole: ReturnType<typeof toRoleWithPermissions> | null = null;
    if (initialStore) {
      storeId = initialStore.storeId;
      if (initialStore.storeRoleId) {
        const raw = await access.storeRolePermissions(initialStore.storeRoleId);
        if (raw) storeRole = toRoleWithPermissions(raw);
      }
    }

    const { role, permissions } = resolveEffectivePermissions(globalRoles, storeRole);

    await new AuditService(this.prisma).log({
      ctx: { ...ctx, storeId, role, permissions },
      action: "LOGIN",
      ip: input.ip,
      device: input.device,
    });

    return {
      tenantId: user.tenantId,
      userId: user.id,
      name: user.name,
      email: user.email,
      storeId,
      role,
      permissions,
    };
  }
}