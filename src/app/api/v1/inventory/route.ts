import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { StockService } from "@/modules/inventory/services/stock-service";
import { prisma } from "@/lib/prisma";

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const storeId = next.nextUrl.searchParams.get("storeId") ?? ctx.storeId ?? undefined;
  const search = next.nextUrl.searchParams.get("search") ?? undefined;
  const rows = await new StockService(prisma).listAll(ctx, storeId, {
    search,
    includeZero: true,
  });
  return NextResponse.json({ rows });
});