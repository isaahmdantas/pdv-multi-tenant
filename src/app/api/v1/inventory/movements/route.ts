import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { StockService } from "@/modules/inventory/services/stock-service";
import { prisma } from "@/lib/prisma";

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const storeId = next.nextUrl.searchParams.get("storeId") ?? ctx.storeId ?? undefined;
  const productId = next.nextUrl.searchParams.get("productId") ?? undefined;
  const type = next.nextUrl.searchParams.get("type") ?? undefined;
  const limit = next.nextUrl.searchParams.get("limit") ?? undefined;
  const movements = await new StockService(prisma).history(ctx, storeId, {
    productId,
    type: type as "IN" | "OUT" | "ADJUST" | "TRANSFER_IN" | "TRANSFER_OUT" | undefined,
    limit: limit ? Number(limit) : undefined,
  });
  return NextResponse.json({ movements });
});