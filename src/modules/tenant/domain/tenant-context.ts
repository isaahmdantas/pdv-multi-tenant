export interface TenantContext {
  tenantId: string;
  userId: string;
  storeId: string | null;
  role: string;
  permissions: string[];
}