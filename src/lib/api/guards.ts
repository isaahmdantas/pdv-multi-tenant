import { NextResponse } from "next/server";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import { getSessionContext } from "@/lib/session";
import { ApiError } from "@/lib/api/errors";

type ApiHandler<Args extends unknown[] = unknown[]> = (
  ctx: TenantContext,
  request: Request,
  ...args: Args
) => Promise<Response> | Response;

/**
 * Middleware de API (F2-04): resolve o TenantContext da sessão, exige
 * autenticação (401) e a permissão opcional (403), e converte ApiError
 * em resposta JSON. Defesa em profundidade — o contexto vem somente da sessão.
 */
export function withApiGuards<Args extends unknown[]>(
  handler: ApiHandler<Args>,
  requiredPermission?: string,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const ctx = await getSessionContext(request);

    if (!ctx) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Não autenticado" } },
        { status: 401 },
      );
    }

    if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Acesso negado" } },
        { status: 403 },
      );
    }

    try {
      return await handler(ctx, request, ...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.toJSON() }, { status: err.status });
      }
      throw err;
    }
  };
}