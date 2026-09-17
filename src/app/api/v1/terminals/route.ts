import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createTerminalSchema } from "@/modules/stores/schemas";
import { TerminalService } from "@/modules/stores/services/terminal-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx, request) => {
  const storeId = new URL(request.url).searchParams.get("storeId") ?? undefined;
  const terminals = await new TerminalService(prisma).list(ctx, storeId);
  return NextResponse.json({ terminals });
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

  const parsed = createTerminalSchema.safeParse(body);
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

  const created = await new TerminalService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ terminal: created }, { status: 201 });
}, "settings.manage");