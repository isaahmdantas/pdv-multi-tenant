import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { updateUnitMeasureSchema } from "@/modules/products/schemas";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withApiGuards(async (ctx, _request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;
  const unitMeasure = await new UnitMeasureService(prisma).get(ctx, id);
  return NextResponse.json({ unitMeasure });
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

  const parsed = updateUnitMeasureSchema.safeParse(body);
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

  const updated = await new UnitMeasureService(prisma).update(ctx, id, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ unitMeasure: updated });
}, "products.update");

export const DELETE = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { id } = await routeCtx.params;
  await new UnitMeasureService(prisma).deactivate(ctx, id, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}, "products.delete");