export const PERMISSIONS = [
  "sales.create",
  "sales.cancel",
  "sales.discount",
  "sales.refund",
  "cash.open",
  "cash.close",
  "cash.withdraw",
  "cash.supply",
  "products.create",
  "products.update",
  "products.delete",
  "inventory.adjust",
  "inventory.transfer",
  "purchases.manage",
  "fiscal.issue",
  "fiscal.cancel",
  "reports.view",
  "settings.manage",
  "pricing.manage",
  "customers.manage",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export interface RoleDefinition {
  name: string;
  description: string;
  globalStoreAccess: boolean;
  permissions: readonly PermissionCode[];
}

export const DEFAULT_ROLES: Record<string, RoleDefinition> = {
  ADMIN: {
    name: "ADMIN",
    description: "Acesso total em todas as unidades",
    globalStoreAccess: true,
    permissions: [...PERMISSIONS],
  },
  GERENTE: {
    name: "GERENTE",
    description: "Gerencia vendas, caixa, estoque e preços",
    globalStoreAccess: true,
    permissions: [
      "sales.create",
      "sales.cancel",
      "sales.discount",
      "sales.refund",
      "cash.open",
      "cash.close",
      "cash.withdraw",
      "cash.supply",
      "products.create",
      "products.update",
      "inventory.adjust",
      "inventory.transfer",
      "purchases.manage",
      "reports.view",
      "pricing.manage",
      "customers.manage",
    ],
  },
  OPERADOR: {
    name: "OPERADOR",
    description: "Opera o caixa em unidades atribuídas",
    globalStoreAccess: false,
    permissions: [
      "sales.create",
      "sales.cancel",
      "cash.open",
      "cash.close",
    ],
  },
};