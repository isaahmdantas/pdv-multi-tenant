import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { CashSessionService } from "@/modules/cash/services/cash-session-service";
import { prisma } from "@/lib/prisma";

const cashSessionService = new CashSessionService(prisma);

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const id = next.nextUrl.pathname.split("/").pop()!;
  const session = await cashSessionService.get(ctx, id);
  return NextResponse.json({ session });
}, "reports.view");