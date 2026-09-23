import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { SaleService } from "@/modules/sales/services/sale-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

const saleService = new SaleService(prisma);

export const POST = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const id = next.nextUrl.pathname.split("/")[4];

  const sale = await saleService.cancel(ctx, id, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ sale }, { status: 200 });
}, "sales.cancel");