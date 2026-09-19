import { z } from "zod";
import { positiveMoneySchema } from "@/lib/money";

const documentSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length === 11 || v.length === 14,
    "Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos",
  )
  .nullish();

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  document: documentSchema,
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(190).nullish(),
  phone: z.string().trim().min(1).max(30).nullish(),
  address: z.string().trim().min(1).max(300).nullish(),
  city: z.string().trim().min(1).max(100).nullish(),
  state: z.string().trim().min(2).max(2).toUpperCase().nullish(),
  zipCode: z.string().trim().min(1).max(20).nullish(),
  notes: z.string().trim().min(1).max(2000).nullish(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Produto é obrigatório"),
  quantity: positiveMoneySchema,
  unitOfMeasureId: z.string().min(1).nullish(),
  unitCost: positiveMoneySchema,
  batchNumber: z.string().trim().min(1).max(100).nullish(),
  expiryDate: z.coerce.date().nullish(),
});

function hasDuplicateProduct(items: { productId: string }[]): boolean {
  const ids = items.map((i) => i.productId);
  return new Set(ids).size !== ids.length;
}

const purchaseHeaderFields = {
  storeId: z.string().min(1, "Unidade é obrigatória").nullish(),
  supplierId: z.string().min(1).nullish(),
  expectedAt: z.coerce.date().nullish(),
  notes: z.string().trim().min(1).max(2000).nullish(),
};

export const createPurchaseSchema = z
  .object({
    ...purchaseHeaderFields,
    items: z.array(purchaseItemSchema).min(1, "Informe ao menos um item").max(200),
  })
  .refine((v) => !hasDuplicateProduct(v.items), {
    message: "Não é permitido repetir o mesmo produto no pedido",
    path: ["items"],
  });

export const updatePurchaseSchema = z
  .object({
    ...purchaseHeaderFields,
    items: z.array(purchaseItemSchema).min(1, "Informe ao menos um item").max(200).optional(),
  })
  .refine((v) => !v.items || !hasDuplicateProduct(v.items), {
    message: "Não é permitido repetir o mesmo produto no pedido",
    path: ["items"],
  });

export const receivePurchaseSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Produto é obrigatório"),
        batchNumber: z.string().trim().min(1).max(100).nullish(),
        expiryDate: z.coerce.date().nullish(),
      }),
    )
    .optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;