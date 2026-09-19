import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { updateProductPriceSchema } from "@/modules/pricing/schemas";
import { ProductPriceService } from "@/modules/pricing/services/product-price-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

type RouteCtx = { params: Promise<{ id: string; productPriceId: string }> };

export const PUT = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { productPriceId } = await routeCtx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
      { status: 400 },
    );
  }

  const parsed = updateProductPriceSchema.safeParse(body);
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

  const updated = await new ProductPriceService(prisma).update(ctx, productPriceId, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ productPrice: updated });
}, "pricing.manage");

export const DELETE = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { productPriceId } = await routeCtx.params;
  await new ProductPriceService(prisma).remove(ctx, productPriceId, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}, "pricing.manage");