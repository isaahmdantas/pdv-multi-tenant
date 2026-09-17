import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { TerminalService } from "@/modules/stores/services/terminal-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const DELETE = withApiGuards(
  async (ctx, request, routeCtx: { params: Promise<{ id: string }> }) => {
    const { id } = await routeCtx.params;
    const result = await new TerminalService(prisma).deactivate(ctx, id, {
      ip: clientIp(request),
      device: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ terminal: result });
  },
  "settings.manage",
);