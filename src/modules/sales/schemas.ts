import { z } from "zod";
import { moneySchema, positiveMoneySchema } from "@/lib/money";
import { PAYMENT_METHOD_CODES } from "@/modules/cash/constants";
import { SALE_STATUSES } from "./constants";

export const saleItemSchema = z.object({
  productId: z.string().cuid2("Produto inválido"),
  quantity: positiveMoneySchema,
  unitPrice: moneySchema.default("0"),
  discount: moneySchema.default("0"),
  total: moneySchema.optional(),
  priceTableId: z.string().cuid2().nullish(),
  promotionId: z.string().cuid2().nullish(),
});

export const salePaymentSchema = z.object({
  methodCode: z.enum(PAYMENT_METHOD_CODES as [string, ...string[]]),
  amount: positiveMoneySchema,
});

export const createSaleSchema = z
  .object({
    storeId: z.string().cuid2().optional(),
    terminalId: z.string().cuid2().optional(),
    cashSessionId: z.string().cuid2("Sessão de caixa inválida"),
    customerId: z.string().cuid2().optional(),
    clientOperationId: z.string().trim().min(1).max(64).optional(),
    discount: moneySchema.default("0"),
    payments: z.array(salePaymentSchema).min(1, "Informe ao menos uma forma de pagamento"),
    items: z.array(saleItemSchema).min(1, "Informe ao menos um item"),
  })
  .refine((v) => {
    const ids = v.items.map((i) => i.productId);
    return new Set(ids).size === ids.length;
  }, "Itens duplicados não são permitidos");

export const saleQuerySchema = z.object({
  storeId: z.string().cuid2().optional(),
  status: z.enum(SALE_STATUSES).optional(),
  cashSessionId: z.string().cuid2().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type SaleItemInput = z.input<typeof saleItemSchema>;
export type SalePaymentInput = z.input<typeof salePaymentSchema>;
export type CreateSaleInput = z.input<typeof createSaleSchema>;
export type SaleQueryInput = z.infer<typeof saleQuerySchema>;