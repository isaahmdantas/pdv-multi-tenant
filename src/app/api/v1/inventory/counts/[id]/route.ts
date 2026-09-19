import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { InventoryService } from "@/modules/inventory/services/inventory-service";
import { prisma } from "@/lib/prisma";

export const GET = withApiGuards(async (ctx, _request, routeCtx: { params: Promise<{ id: string }> }) => {
  const { id } = await routeCtx.params;
  const inventory = await new InventoryService(prisma).get(ctx, id);
  return NextResponse.json({ inventory });
});