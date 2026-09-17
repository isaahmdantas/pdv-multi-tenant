import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";

export const GET = withApiGuards(async (ctx) => {
  return NextResponse.json({
    session: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      storeId: ctx.storeId,
      role: ctx.role,
      permissions: ctx.permissions,
    },
  });
});