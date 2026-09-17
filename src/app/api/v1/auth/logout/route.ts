import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withApiGuards } from "@/lib/api/guards";
import { AuditService } from "@/modules/audit/services/audit-service";
import { prisma } from "@/lib/prisma";
import { sessionTokenCookieName } from "@/lib/session-cookies";
import { clientIp } from "@/lib/api/rate-limit";

export const POST = withApiGuards(async (ctx, request) => {
  await new AuditService(prisma).log({
    ctx,
    action: "LOGOUT",
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  const jar = await cookies();
  jar.delete(sessionTokenCookieName());

  return NextResponse.json({ ok: true });
});