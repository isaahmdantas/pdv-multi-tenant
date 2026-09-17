import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { updateProductStoreSchema } from "@/modules/products/schemas";
import { ProductService } from "@/modules/products/services/product-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

type RouteCtx = { params: Promise<{ id: string; storeId: string }> };

export const PUT = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { id, storeId } = await routeCtx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
      { status: 400 },
    );
  }

  const parsed = updateProductStoreSchema.safeParse(body);
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

  const link = await new ProductService(prisma).setStoreStatus(ctx, id, storeId, parsed.data.status, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ link });
}, "products.update");