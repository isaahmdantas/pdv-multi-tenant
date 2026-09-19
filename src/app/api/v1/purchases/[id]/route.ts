import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { updatePurchaseSchema } from "@/modules/purchases/schemas";
import { PurchaseService } from "@/modules/purchases/services/purchase-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withApiGuards(async (ctx, _request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;
  const purchase = await new PurchaseService(prisma).get(ctx, id);
  return NextResponse.json({ purchase });
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

  const parsed = updatePurchaseSchema.safeParse(body);
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

  const updated = await new PurchaseService(prisma).update(ctx, id, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ purchase: updated });
}, "purchases.manage");

export const DELETE = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;
  const cancelled = await new PurchaseService(prisma).cancel(ctx, id, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ purchase: cancelled });
}, "purchases.manage");