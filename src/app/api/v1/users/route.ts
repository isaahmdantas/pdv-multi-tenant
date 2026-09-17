import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createUserSchema } from "@/modules/iam/schemas";
import { UserRepository } from "@/modules/iam/repositories/user-repository";
import { UserService } from "@/modules/iam/services/user-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx) => {
  const repo = new UserRepository(prisma, ctx);
  const users = await repo.list();
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      roles: u.roles.map((r) => r.role.name),
      stores: u.userStores.map((us) => ({
        storeId: us.store.id,
        name: us.store.name,
        code: us.store.code,
      })),
    })),
  });
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

  const parsed = createUserSchema.safeParse(body);
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

  const created = await new UserService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ user: created }, { status: 201 });
}, "settings.manage");