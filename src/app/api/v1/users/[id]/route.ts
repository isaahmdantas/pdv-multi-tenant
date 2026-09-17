import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { UserStoreService } from "@/modules/iam/services/user-store-service";
import { prisma } from "@/lib/prisma";

export const GET = withApiGuards(async (ctx, _request, routeCtx: { params: Promise<{ id: string }> }) => {
  const { id } = await routeCtx.params;
  const result = await new UserStoreService(prisma).listForUser(ctx, id);
  return NextResponse.json({ user: result });
}, "settings.manage");