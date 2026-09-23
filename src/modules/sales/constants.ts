export const SALE_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_STATUS_DEFAULT: SaleStatus = 'COMPLETED';