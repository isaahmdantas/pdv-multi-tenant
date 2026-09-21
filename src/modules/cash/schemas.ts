import { z } from 'zod';
import { moneySchema, positiveMoneySchema } from '@/lib/money';
import { CASH_MOVEMENT_TYPES, PAYMENT_METHOD_CODES } from './constants';

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().cuid2('ID do caixa inválido'),
  openingAmount: moneySchema.default('0'),
  notes: z.string().max(500).optional(),
});

export const cashMovementSchema = z.object({
  type: z.enum(CASH_MOVEMENT_TYPES as [string, ...string[]]),
  methodCode: z.enum(PAYMENT_METHOD_CODES as [string, ...string[]]).optional(),
  amount: positiveMoneySchema,
  notes: z.string().max(500).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().cuid2().optional(),
});

export const supplySchema = z.object({
  amount: positiveMoneySchema,
  methodCode: z.enum(PAYMENT_METHOD_CODES as [string, ...string[]]).default('CASH'),
  notes: z.string().max(500).optional(),
});

export const withdrawSchema = z.object({
  amount: positiveMoneySchema,
  methodCode: z.enum(PAYMENT_METHOD_CODES as [string, ...string[]]).default('CASH'),
  notes: z.string().max(500).optional(),
});

export const closeCashSessionSchema = z.object({
  countedByMethod: z.record(z.string(), moneySchema).refine((val) => Object.keys(val).length > 0, {
    message: 'Informe ao menos uma forma de pagamento',
  }),
});

export const cashSessionQuerySchema = z.object({
  storeId: z.string().cuid2().optional(),
  status: z.enum(['OPEN', 'CLOSED'] as [string, ...string[]]).optional(),
  cashRegisterId: z.string().cuid2().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type SupplyInput = z.infer<typeof supplySchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
export type CashSessionQueryInput = z.infer<typeof cashSessionQuerySchema>;