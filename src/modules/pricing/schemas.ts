import { z } from "zod";
import { moneySchema, positiveMoneySchema } from "@/lib/money";
import { DISCOUNT_TYPE } from "@/modules/pricing/constants";

const priceTableFields = {
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  description: z.string().trim().min(1).max(2000).nullish(),
  storeId: z.string().min(1).nullish(),
  customerCategoryId: z.string().min(1).nullish(),
  defaultPrice: moneySchema.default("0"),
  priority: z.number().int().min(0).max(1000).default(0),
  validFrom: z.coerce.date().nullish(),
  validUntil: z.coerce.date().nullish(),
  active: z.boolean().default(true),
};

function validateUntil(
  v: { validFrom?: Date | null; validUntil?: Date | null },
): boolean {
  return !v.validUntil || !v.validFrom || v.validUntil.getTime() > v.validFrom.getTime();
}

const priceTableRefinements = {
  message: "validUntil deve ser posterior a validFrom",
  path: ["validUntil"],
};

export const createPriceTableSchema = z
  .object(priceTableFields)
  .refine(validateUntil, priceTableRefinements);

export const updatePriceTableSchema = z
  .object(priceTableFields)
  .partial()
  .refine(validateUntil, priceTableRefinements);

const productPriceFields = {
  priceTableId: z.string().min(1, "Tabela de preço é obrigatória"),
  productId: z.string().min(1, "Produto é obrigatório"),
  unitPrice: positiveMoneySchema,
  minimumQuantity: positiveMoneySchema.nullish(),
  maximumQuantity: positiveMoneySchema.nullish(),
};

function validateRange(v: {
  minimumQuantity?: string | number | null;
  maximumQuantity?: string | number | null;
}): boolean {
  if (v.minimumQuantity === undefined || v.maximumQuantity === undefined) return true;
  if (v.minimumQuantity === null || v.maximumQuantity === null) return true;
  const min = typeof v.minimumQuantity === "number" ? v.minimumQuantity : parseFloat(v.minimumQuantity);
  const max = typeof v.maximumQuantity === "number" ? v.maximumQuantity : parseFloat(v.maximumQuantity);
  return min <= max;
}

const rangeRefinements = {
  message: "minimumQuantity não pode ser maior que maximumQuantity",
  path: ["minimumQuantity"],
};

export const createProductPriceSchema = z
  .object(productPriceFields)
  .refine(validateRange, rangeRefinements);

export const updateProductPriceSchema = z
  .object(productPriceFields)
  .partial()
  .refine(validateRange, rangeRefinements);

const promotionFields = {
  storeId: z.string().min(1).nullish(),
  productId: z.string().min(1).nullish(),
  customerCategoryId: z.string().min(1).nullish(),
  discountType: z.enum(DISCOUNT_TYPE),
  discountValue: positiveMoneySchema,
  validFrom: z.coerce.date().nullish(),
  validUntil: z.coerce.date().nullish(),
  active: z.boolean().default(true),
};

function validateDiscount(v: {
  discountType?: "PERCENTAGE" | "FIXED";
  discountValue?: string | number;
}): boolean {
  if (v.discountType === undefined) return true;
  if (v.discountType === "FIXED") return true;
  const numeric = typeof v.discountValue === "number" ? v.discountValue : parseFloat(v.discountValue ?? "");
  return numeric <= 100;
}

const discountRefinements = {
  message: "Desconto percentual deve estar entre 0 e 100",
  path: ["discountValue"],
};

export const createPromotionSchema = z
  .object(promotionFields)
  .refine(validateDiscount, discountRefinements)
  .refine(
    (v) => validateUntil(v),
    { ...priceTableRefinements, path: ["validUntil"] },
  );

export const updatePromotionSchema = z
  .object(promotionFields)
  .partial()
  .refine(validateDiscount, discountRefinements)
  .refine(
    (v) => validateUntil(v),
    { ...priceTableRefinements, path: ["validUntil"] },
  );

export const resolvePriceSchema = z.object({
  storeId: z.string().cuid2("Unidade inválida").nullish(),
  productId: z.string().cuid2("Produto inválido"),
  customerId: z.string().cuid2().nullish(),
  customerCategoryId: z.string().cuid2().nullish(),
  quantity: positiveMoneySchema.nullish(),
  dateTime: z.coerce.date().nullish(),
});

export type ResolvePriceInput = z.infer<typeof resolvePriceSchema>;

export type CreatePriceTableInput = z.infer<typeof createPriceTableSchema>;
export type UpdatePriceTableInput = z.infer<typeof updatePriceTableSchema>;
export type CreateProductPriceInput = z.infer<typeof createProductPriceSchema>;
export type UpdateProductPriceInput = z.infer<typeof updateProductPriceSchema>;
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;