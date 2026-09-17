import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createCashRegisterSchema } from "@/modules/stores/schemas";
import { CashRegisterService } from "@/modules/stores/services/cash-register-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx, request) => {
  const storeId = new URL(request.url).searchParams.get("storeId") ?? undefined;
  const registers = await new CashRegisterService(prisma).list(ctx, storeId);
  return NextResponse.json({ cashRegisters: registers });
}, "settings.manage");

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

  const parsed = createCashRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const created = await new CashRegisterService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ cashRegister: created }, { status: 201 });
}, "settings.manage");