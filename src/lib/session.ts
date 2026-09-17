import { getToken } from "next-auth/jwt";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import {
  authSecret,
  authUseSecureCookies,
  sessionTokenCookieName,
} from "@/lib/session-cookies";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * F3-04: resolve o TenantContext exclusivamente a partir do JWT assinado
 * (cookie httpOnly). NUNCA aceita tenantId/storeId provenientes do cliente.
 */
export async function getSessionContext(request: Request): Promise<TenantContext | null> {
  const token = await getToken({
    req: request,
    secret: authSecret(),
    cookieName: sessionTokenCookieName(),
    secureCookie: authUseSecureCookies(),
  });

  if (!token?.sub || !token.tenantId) return null;

  return {
    tenantId: token.tenantId as string,
    userId: token.sub,
    storeId: asString(token.storeId),
    role: asString(token.role) ?? "NONE",
    permissions: Array.isArray(token.permissions)
      ? (token.permissions as string[])
      : [],
  };
}