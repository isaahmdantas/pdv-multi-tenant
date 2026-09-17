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

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(190),
  password: z.string().min(1, "Senha é obrigatória").max(128),
  tenantSlug: z.string().trim().min(1).max(120).nullish(),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Nome da role é obrigatório").max(60),
  description: z.string().trim().max(255).nullish(),
  globalStoreAccess: z.boolean().default(false),
  permissionCodes: z
    .array(z.string().min(1))
    .min(1, "Ao menos uma permissão é obrigatória"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type SwitchStoreInput = z.infer<typeof switchStoreSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;