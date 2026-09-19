import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createProductPriceSchema } from "@/modules/pricing/schemas";
import { ProductPriceService } from "@/modules/pricing/services/product-price-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withApiGuards(async (ctx, _request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;
  const productPrices = await new ProductPriceService(prisma).listByTable(ctx, id);
  return NextResponse.json({ productPrices });
});

export const POST = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
      { status: 400 },
    );
  }

  const parsed = createProductPriceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const created = await new ProductPriceService(prisma).create(
    ctx,
    { ...parsed.data, priceTableId: id },
    {
      ip: clientIp(request),
      device: request.headers.get("user-agent") ?? undefined,
    },
  );

  return NextResponse.json({ productPrice: created }, { status: 201 });
}, "pricing.manage");