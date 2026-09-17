import { describe, expect, it } from "vitest";
import { TenantScopedRepository } from "@/modules/tenant/repositories/tenant-scoped-repository";
import {
  resolveEffectivePermissions,
  permissionsOfRole,
  authorize,
} from "@/modules/iam/services/authorization-service";
import { withApiGuards } from "@/lib/api/guards";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

function ctx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: "tenant-a",
    userId: "user-a",
    storeId: null,
    role: "ADMIN",
    permissions: ["sales.create", "reports.view"],
    ...overrides,
  };
}

class FakeRepo extends TenantScopedRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super({} as any, ctx());
  }

  scopeQuery(where: Record<string, unknown>) {
    return this.scope(where);
  }

  scopeStoreQuery(where: Record<string, unknown>) {
    return this.scopeStore(where);
  }
}

describe("resolveEffectivePermissions", () => {
  const globalAdmin = {
    id: "r1",
    name: "ADMIN",
    globalStoreAccess: true,
    permissions: ["sales.create", "cash.open"],
  };
  const globalOperator = {
    id: "r2",
    name: "OPERADOR",
    globalStoreAccess: false,
    permissions: ["sales.create"],
  };
  const storeRole = {
    id: "r3",
    name: "OPERADOR",
    globalStoreAccess: false,
    permissions: ["cash.open"],
  };

  it("role da unidade vence role global", () => {
    const result = resolveEffectivePermissions([globalAdmin], storeRole);
    expect(result.role).toBe("OPERADOR");
    expect(result.permissions).toEqual(["cash.open"]);
  });

  it("sem role de unidade, une permissões das roles globais sem duplicar", () => {
    const result = resolveEffectivePermissions([globalAdmin, globalOperator], null);
    expect(result.role).toBe("ADMIN");
    expect(result.permissions.sort()).toEqual(["cash.open", "sales.create"]);
  });

  it("sem roles, retorna role NONE e permissões vazias", () => {
    const result = resolveEffectivePermissions([], null);
    expect(result).toEqual({ role: "NONE", permissions: [] });
  });
});

describe("permissionsOfRole", () => {
  it("extrai códigos das permissões", () => {
    const perms = permissionsOfRole({
      rolePermissions: [
        { permission: { code: "sales.create" } },
        { permission: { code: "cash.open" } },
      ],
    });
    expect(perms).toEqual(["sales.create", "cash.open"]);
  });
});

describe("authorize", () => {
  it("lança ApiError 403 se contexto nulo", () => {
    expect(() => authorize(null, "sales.create")).toThrowError(ApiError);
  });

  it("lança ApiError 403 sem a permissão", () => {
    expect(() => authorize(ctx(), "products.delete")).toThrowError(/products.delete/);
  });

  it("passa quando a permissão existe", () => {
    expect(() => authorize(ctx(), "sales.create")).not.toThrow();
  });
});

describe("TenantScopedRepository.scope/scopeStore", () => {
  it("scope injeta tenantId sem sobrescrever filtros existentes", () => {
    const repo = new FakeRepo({});
    expect(repo.scopeQuery({ id: "x" })).toEqual({ id: "x", tenantId: "tenant-a" });
  });

  it("scopeStore injeta tenantId e storeId", () => {
    const repo = new FakeRepo({});
    expect(repo.scopeStoreQuery({})).toEqual({
      tenantId: "tenant-a",
      storeId: null,
    });
  });
});

describe("withApiGuards", () => {
  it("retorna 401 quando não há sessão (F2: nenhuma rota autorizada)", async () => {
    const route = withApiGuards(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const res = await route(new Request("http://localhost/api/v1/x"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("serializa ApiError em JSON com código e mensagem", () => {
    const err = new ApiError(403, "não pode", "FORBIDDEN");
    expect(err.toJSON()).toEqual({ code: "FORBIDDEN", message: "não pode" });
  });
});