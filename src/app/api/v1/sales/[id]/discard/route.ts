import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { SaleService } from "@/modules/sales/services/sale-service";
import { prisma } from "@/lib/prisma";

const saleService = new SaleService(prisma);

export const POST = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const id = next.nextUrl.pathname.split("/")[4];

  await saleService.discard(ctx, id);
  return NextResponse.json({ success: true }, { status: 200 });
}, "sales.create");