import { z } from "zod";
import { moneySchema } from "@/lib/money";

const documentSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length === 11 || v.length === 14,
    "Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos",
  )
  .nullish();

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  document: documentSchema,
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(190).nullish(),
  phone: z.string().trim().min(1).max(30).nullish(),
  birthday: z.coerce.date().nullish(),
  notes: z.string().trim().min(1).max(2000).nullish(),
  customerCategoryId: z.string().min(1).nullish(),
  creditLimit: moneySchema.default("0"),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createCustomerCategorySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  isDefault: z.boolean().default(false),
});

export const updateCustomerCategorySchema = createCustomerCategorySchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateCustomerCategoryInput = z.infer<typeof createCustomerCategorySchema>;
export type UpdateCustomerCategoryInput = z.infer<typeof updateCustomerCategorySchema>;