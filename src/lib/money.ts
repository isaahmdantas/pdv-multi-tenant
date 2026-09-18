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