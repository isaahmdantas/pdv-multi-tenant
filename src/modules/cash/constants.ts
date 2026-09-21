export const CASH_SESSION_STATUSES = ['OPEN', 'CLOSED'];
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];
export const CASH_SESSION_STATUS_DEFAULT: CashSessionStatus = 'OPEN';

export const CASH_MOVEMENT_TYPES = [
  'OPENING',
  'SALE',
  'SUPPLY',
  'WITHDRAW',
  'CLOSING',
  'ADJUSTMENT',
];
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export const CASH_CLASSIFICATIONS = ['EXACT', 'SURPLUS', 'SHORTAGE'];
export type CashClassification = (typeof CASH_CLASSIFICATIONS)[number];

export const PAYMENT_METHOD_CODES = ['CASH', 'PIX', 'CREDIT', 'DEBIT', 'VOUCHER'];
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];