import type { PrismaClient, Prisma as PrismaTypes } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/lib/api/errors";

export interface ConvertedQuantity {
  quantity: PrismaTypes.Decimal;
  quantityInUnit: PrismaTypes.Decimal;
  unitOfMeasureId: string;
}

type QueryClient = PrismaClient | PrismaTypes.TransactionClient;

export async function toBaseQuantity(
  prisma: QueryClient,
  tenantId: string,
  productBaseUnitId: string,
  unitOfMeasureId: string | null | undefined,
  quantity: Prisma.Decimal,
): Promise<ConvertedQuantity> {
  const unit = unitOfMeasureId ?? productBaseUnitId;
  if (unit === productBaseUnitId) {
    return { quantity, quantityInUnit: quantity, unitOfMeasureId: unit };
  }

  const forward = await prisma.unitConversion.findFirst({
    where: { tenantId, fromUnitId: unit, toUnitId: productBaseUnitId },
  });
  if (forward) {
    return { quantity: quantity.mul(forward.factor), quantityInUnit: quantity, unitOfMeasureId: unit };
  }

  const reverse = await prisma.unitConversion.findFirst({
    where: { tenantId, fromUnitId: productBaseUnitId, toUnitId: unit },
  });
  if (reverse) {
    const factor = new Prisma.Decimal(reverse.factor);
    return { quantity: quantity.div(factor), quantityInUnit: quantity, unitOfMeasureId: unit };
  }

  throw badRequest("Conversão de unidade de medida não configurada", "UNIT_CONVERSION_MISSING");
}