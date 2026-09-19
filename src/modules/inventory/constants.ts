export const STOCK_MOVEMENT_TYPES = ["IN", "OUT", "ADJUST", "TRANSFER_IN", "TRANSFER_OUT"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_TRANSFER_STATUSES = ["COMPLETED"] as const;
export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUSES)[number];

export const STOCK_REFERENCE_TYPES = ["SALE", "PURCHASE", "INVENTORY", "TRANSFER"] as const;
export type StockReferenceType = (typeof STOCK_REFERENCE_TYPES)[number];

export const INVENTORY_STATUSES = ["OPEN", "CLOSED"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const STOCK_LEVELS = ["LOW", "OK", "HIGH"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];