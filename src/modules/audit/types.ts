import type { Prisma } from "@/generated/prisma/client";

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "STORE_SWITCHED",
  "SALE_CREATED",
  "SALE_CANCELLED",
  "ITEM_CANCELLED",
  "DISCOUNT_APPLIED",
  "PRICE_CHANGED",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "STOCK_ADJUSTED",
  "CASH_OPENED",
  "CASH_CLOSED",
  "CASH_WITHDRAWAL",
  "CASH_SUPPLY",
  "FISCAL_ISSUED",
  "FISCAL_CANCELLED",
  "USER_CREATED",
  "USER_PERMISSION_CHANGED",
  "PRICING_CHANGED",
  "CUSTOMER_CATEGORY_CHANGED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditTransactionClient = Prisma.TransactionClient;