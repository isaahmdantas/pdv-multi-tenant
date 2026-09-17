import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  code: z.string().trim().min(1, "Código é obrigatório").max(50),
  document: z.string().trim().min(1).max(20).nullish(),
  phone: z.string().trim().min(1).max(30).nullish(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido")
    .max(190)
    .nullish(),
  address: z.string().trim().min(1).max(300).nullish(),
  city: z.string().trim().min(1).max(120).nullish(),
  state: z.string().trim().min(2).max(2).nullish(),
  zipCode: z.string().trim().min(1).max(10).nullish(),
  timezone: z.string().trim().min(1).max(100).default("America/Sao_Paulo"),
  fiscalState: z.string().trim().min(2).max(2).nullish(),
  fiscalEnvironment: z.string().trim().min(1).max(20).nullish(),
  fiscalEnabled: z.boolean().default(false),
  fiscalSeries: z.string().trim().min(1).max(10).nullish(),
});

export const updateStoreSchema = createStoreSchema.partial();

export const createCashRegisterSchema = z.object({
  storeId: z.string().min(1, "storeId é obrigatório"),
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
});

export const createTerminalSchema = z.object({
  storeId: z.string().min(1, "storeId é obrigatório"),
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  code: z.string().trim().min(1, "Código é obrigatório").max(50),
  mode: z.enum(["POS", "SELF_CHECKOUT", "ADMIN"]).default("POS"),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>;
export type CreateTerminalInput = z.infer<typeof createTerminalSchema>;