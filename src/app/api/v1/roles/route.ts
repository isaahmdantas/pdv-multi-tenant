import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createRoleSchema } from "@/modules/iam/schemas";
import { RoleService } from "@/modules/iam/services/role-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx) => {
  const roles = await new RoleService(prisma).list(ctx);
  return NextResponse.json({ roles });
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

  const parsed = createRoleSchema.safeParse(body);
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

  const created = await new RoleService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ role: created }, { status: 201 });
}, "settings.manage");