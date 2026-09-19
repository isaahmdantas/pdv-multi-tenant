import { z } from "zod";
import { moneySchema, positiveMoneySchema } from "@/lib/money";

export const signedMoneySchema = z
  .union([
    z.string().regex(/^-?\d+(\.\d{1,4})?$/, "Valor inválido"),
    z.number().finite(),
  ])
  .refine((v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return n !== 0;
  }, "Delta deve ser diferente de zero");

const stockEntryFields = {
  productId: z.string().min(1, "Produto é obrigatório"),
  quantity: positiveMoneySchema,
  unitOfMeasureId: z.string().min(1).nullish(),
  reason: z.string().trim().min(1).max(500).nullish(),
};

export const stockInSchema = z.object(stockEntryFields);
export const stockOutSchema = z.object(stockEntryFields);

export const stockAdjustSchema = z.object({
  productId: z.string().min(1, "Produto é obrigatório"),
  delta: signedMoneySchema,
  reason: z.string().trim().min(1).max(500).nullish(),
});

const transferItemFields = {
  productId: z.string().min(1, "Produto é obrigatório"),
  quantity: positiveMoneySchema,
  unitOfMeasureId: z.string().min(1).nullish(),
};

function hasDuplicateProduct(items: { productId: string }[]): boolean {
  const ids = items.map((i) => i.productId);
  return new Set(ids).size !== ids.length;
}

const transferItemsRefinement = {
  message: "Não é permitido repetir o mesmo produto na transferência",
  path: ["items"],
};

export const stockTransferSchema = z
  .object({
    destinationStoreId: z.string().min(1, "Unidade de destino é obrigatória"),
    reason: z.string().trim().min(1).max(500).nullish(),
    items: z.array(z.object(transferItemFields)).min(1, "Informe ao menos um item").max(200),
  })
  .refine((v) => !hasDuplicateProduct(v.items), transferItemsRefinement);

export const minMaxSchema = z
  .object({
    productId: z.string().min(1, "Produto é obrigatório"),
    minStock: moneySchema.default("0"),
    maxStock: moneySchema.default("0"),
  })
  .refine(
    (v) => {
      const min = typeof v.minStock === "number" ? v.minStock : parseFloat(v.minStock);
      const max = typeof v.maxStock === "number" ? v.maxStock : parseFloat(v.maxStock);
      return min <= max;
    },
    { message: "minStock não pode ser maior que maxStock", path: ["minStock"] },
  );

export const openInventorySchema = z.object({
  notes: z.string().trim().min(1).max(2000).nullish(),
});

export const closeInventorySchema = z
  .object({
    notes: z.string().trim().min(1).max(2000).nullish(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, "Produto é obrigatório"),
          countedQuantity: moneySchema,
        }),
      )
      .min(1, "Informe ao menos um item contado"),
  })
  .refine((v) => !hasDuplicateProduct(v.items), {
    message: "Não é permitido repetir o mesmo produto na contagem",
    path: ["items"],
  });

export type CreateStockEntryInput = z.infer<typeof stockInSchema>;
export type CreateStockAdjustInput = z.infer<typeof stockAdjustSchema>;
export type CreateStockTransferInput = z.infer<typeof stockTransferSchema>;
export type UpdateMinMaxInput = z.infer<typeof minMaxSchema>;
export type OpenInventoryInput = z.infer<typeof openInventorySchema>;
export type CloseInventoryInput = z.infer<typeof closeInventorySchema>;