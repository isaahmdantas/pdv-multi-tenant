import type { TenantContext } from "@/modules/tenant/domain/tenant-context";

/**
 * Fase 2: símbolo da camada de sessão (F2-04).
 * Em F3 (Auth.js v5) esta função lê o JWT (httpOnly), valida e monta o
 * TenantContext no servidor. Enquanto não há autenticação, retorna null
 * (nenhuma rota autorizada). Nunca aceita tenantId/storeId do cliente.
 */
export async function getSessionContext(request: Request): Promise<TenantContext | null> {
  void request;
  return null;
}