import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { PricingService } from "@/modules/pricing/services/pricing-service";
import { prisma } from "@/lib/prisma";
import { resolvePriceSchema } from "@/modules/pricing/schemas";

const pricingService = new PricingService(prisma);

export const POST = withApiGuards(async (ctx, request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
      { status: 400 },
    );
  }

  const parsed = resolvePriceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const storeId = parsed.data.storeId ?? ctx.storeId;
  if (!storeId) {
    return NextResponse.json(
      { error: { code: "STORE_REQUIRED", message: "Informe a unidade (storeId)" } },
      { status: 400 },
    );
  }

  const result = await pricingService.resolve({
    tenantId: ctx.tenantId,
    storeId,
    productId: parsed.data.productId,
    customerId: parsed.data.customerId ?? null,
    customerCategoryId: parsed.data.customerCategoryId ?? null,
    quantity: parsed.data.quantity ? Number(parsed.data.quantity) : undefined,
    dateTime: parsed.data.dateTime ?? undefined,
  });

  return NextResponse.json({
    price: {
      unitPrice: result.unitPrice.toString(),
      displayPrice: result.displayPrice.toString(),
      priceTableId: result.priceTableId ?? null,
      promotionId: result.promotionId ?? null,
      appliedRule: result.appliedRule,
    },
  });
}, "sales.create");