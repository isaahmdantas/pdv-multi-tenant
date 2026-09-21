import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { CashSessionService } from "@/modules/cash/services/cash-session-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";
import { cashSessionQuerySchema, openCashSessionSchema } from "@/modules/cash/schemas";

const cashSessionService = new CashSessionService(prisma);

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const storeId = next.nextUrl.searchParams.get("storeId") ?? ctx.storeId ?? undefined;
  const status = next.nextUrl.searchParams.get("status") ?? undefined;
  const cashRegisterId = next.nextUrl.searchParams.get("cashRegisterId") ?? undefined;
  const fromDate = next.nextUrl.searchParams.get("fromDate") ? new Date(next.nextUrl.searchParams.get("fromDate")!) : undefined;
  const toDate = next.nextUrl.searchParams.get("toDate") ? new Date(next.nextUrl.searchParams.get("toDate")!) : undefined;

  const parsed = cashSessionQuerySchema.safeParse({ storeId, status, cashRegisterId, fromDate, toDate });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Parâmetros inválidos", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const sessions = await cashSessionService.list(ctx, parsed.data);
  return NextResponse.json({ sessions });
}, "reports.view");

export const POST = withApiGuards(async (ctx, request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
      { status: 400 },
    );
  }

  const parsed = openCashSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const session = await cashSessionService.open(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ session }, { status: 201 });
}, "cash.open");