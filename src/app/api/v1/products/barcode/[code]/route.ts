import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { ProductService } from "@/modules/products/services/product-service";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ code: string }> };

export const GET = withApiGuards(async (ctx, _request, routeCtx: RouteCtx) => {
  const { code } = await routeCtx.params;
  const product = await new ProductService(prisma).findByBarcode(ctx, code);
  return NextResponse.json({ product });
});