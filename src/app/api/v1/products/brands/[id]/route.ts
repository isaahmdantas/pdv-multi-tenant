import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { updateProductBrandSchema } from "@/modules/products/schemas";
import { ProductBrandService } from "@/modules/products/services/product-brand-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withApiGuards(async (ctx, _request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;
  const brand = await new ProductBrandService(prisma).get(ctx, id);
  return NextResponse.json({ brand });
});

export const PUT = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
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

  const parsed = updateProductBrandSchema.safeParse(body);
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

  const updated = await new ProductBrandService(prisma).update(ctx, id, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ brand: updated });
}, "products.update");

export const DELETE = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;
  await new ProductBrandService(prisma).deactivate(ctx, id, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}, "products.delete");