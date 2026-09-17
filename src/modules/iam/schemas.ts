import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(190),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128),
  roleIds: z.array(z.string().min(1)).min(1, "Ao menos uma role é obrigatória"),
  stores: z
    .array(
      z.object({
        storeId: z.string().min(1),
        storeRoleId: z.string().min(1).nullable().optional(),
      }),
    )
    .default([]),
});

export const switchStoreSchema = z.object({
  storeId: z.string().min(1, "storeId é obrigatório"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type SwitchStoreInput = z.infer<typeof switchStoreSchema>;