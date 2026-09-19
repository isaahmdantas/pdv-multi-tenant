import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { StockService } from "@/modules/inventory/services/stock-service";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api/errors";

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const storeId = next.nextUrl.searchParams.get("storeId") ?? ctx.storeId ?? undefined;
  const productId = next.nextUrl.searchParams.get("productId");
  if (!productId) throw new ApiError(400, "Informe o productId", "VALIDATION_ERROR");
  const balance = await new StockService(prisma).balance(ctx, storeId, productId);
  return NextResponse.json({ balance });
});