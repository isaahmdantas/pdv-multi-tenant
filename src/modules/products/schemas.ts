import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const moneySchema = z.union([
  z.string().regex(/^\d+(\.\d{1,4})?$/, "Valor monetário inválido"),
  z.number().finite().nonnegative(),
]);

export const positiveMoneySchema = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Valor monetário inválido")
    .refine((v) => Number(v) > 0, "Deve ser maior que zero"),
  z.number().finite().positive(),
]);

export function toDecimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export type MoneyInput = z.infer<typeof moneySchema>;

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  sku: z.string().trim().min(1, "SKU é obrigatório").max(50),
  description: z.string().trim().min(1).max(2000).nullish(),
  categoryId: z.string().min(1).nullish(),
  brandId: z.string().min(1).nullish(),
  baseUnitId: z.string().min(1, "Unidade de medida é obrigatória"),
  basePrice: moneySchema.default("0"),
  barcodes: z.array(z.string().trim().min(1).max(50)).min(1).max(20).nullish(),
  ncm: z.string().trim().min(1).max(20).nullish(),
  cest: z.string().trim().min(1).max(20).nullish(),
  cfop: z.string().trim().min(1).max(20).nullish(),
  isService: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export const createProductCategorySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

export const createProductBrandSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
});

export const updateProductBrandSchema = createProductBrandSchema.partial();

export const createUnitMeasureSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Código é obrigatório")
    .max(10),
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
});

export const updateUnitMeasureSchema = createUnitMeasureSchema.partial();

export const createUnitConversionSchema = z.object({
  toUnitId: z.string().min(1, "toUnitId é obrigatório"),
  factor: positiveMoneySchema,
});

export const updateProductStoreSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
export type CreateProductBrandInput = z.infer<typeof createProductBrandSchema>;
export type UpdateProductBrandInput = z.infer<typeof updateProductBrandSchema>;
export type CreateUnitMeasureInput = z.infer<typeof createUnitMeasureSchema>;
export type UpdateUnitMeasureInput = z.infer<typeof updateUnitMeasureSchema>;
export type CreateUnitConversionInput = z.infer<typeof createUnitConversionSchema>;
export type UpdateProductStoreInput = z.infer<typeof updateProductStoreSchema>;