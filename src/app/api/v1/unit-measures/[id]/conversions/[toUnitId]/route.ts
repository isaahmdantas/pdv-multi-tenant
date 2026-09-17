import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

type RouteCtx = { params: Promise<{ id: string; toUnitId: string }> };

export const DELETE = withApiGuards(async (ctx, request, routeCtx: RouteCtx) => {
  const { id, toUnitId } = await routeCtx.params;
  await new UnitMeasureService(prisma).removeConversion(ctx, id, toUnitId, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ ok: true });
}, "products.delete");