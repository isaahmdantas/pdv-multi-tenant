import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { SaleService } from "@/modules/sales/services/sale-service";
import { prisma } from "@/lib/prisma";

const saleService = new SaleService(prisma);

export const GET = withApiGuards(async (ctx, _request) => {
  const sales = await saleService.list(ctx, { status: "SUSPENDED" });
  return NextResponse.json({ sales }, { status: 200 });
}, "sales.create");