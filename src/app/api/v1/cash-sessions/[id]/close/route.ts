import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { CashSessionService } from "@/modules/cash/services/cash-session-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";
import { closeCashSessionSchema } from "@/modules/cash/schemas";

const cashSessionService = new CashSessionService(prisma);

export const POST = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const id = next.nextUrl.pathname.split("/")[4];

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
      { status: 400 },
    );
  }

  const parsed = closeCashSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const session = await cashSessionService.close(ctx, id, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ session });
}, "cash.close");