import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { CashRegisterService } from "@/modules/stores/services/cash-register-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const DELETE = withApiGuards(
  async (ctx, request, routeCtx: { params: Promise<{ id: string }> }) => {
    const { id } = await routeCtx.params;
    const result = await new CashRegisterService(prisma).deactivate(ctx, id, {
      ip: clientIp(request),
      device: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ cashRegister: result });
  },
  "settings.manage",
);