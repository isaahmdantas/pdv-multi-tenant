import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encode, decode } from "next-auth/jwt";
import { withApiGuards } from "@/lib/api/guards";
import { switchStoreSchema } from "@/modules/iam/schemas";
import { StoreSwitchService } from "@/modules/iam/services/store-switch-service";
import { AuditService } from "@/modules/audit/services/audit-service";
import { prisma } from "@/lib/prisma";
import {
  authSecret,
  sessionTokenCookieName,
  sessionCookieOptions,
  SESSION_MAX_AGE,
} from "@/lib/session-cookies";
import { clientIp } from "@/lib/api/rate-limit";

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

  const parsed = switchStoreSchema.safeParse(body);
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

  // A seleção de unidade NUNCA vem da confiança do frontend: valida acesso e
  // recalcula role/permissões efetivas a partir do banco (F3-08).
  const { storeId, role, permissions } = await new StoreSwitchService(
    prisma,
  ).authorizeSwitch(ctx.tenantId, ctx.userId, parsed.data.storeId);

  const secret = authSecret();
  const cookieName = sessionTokenCookieName();
  const jar = await cookies();

  const current = await decode({
    token: jar.get(cookieName)?.value,
    secret,
    salt: cookieName,
  });

  const updated = {
    ...(current ?? {}),
    sub: ctx.userId,
    tenantId: ctx.tenantId,
    storeId,
    role,
    permissions,
  };

  const token = await encode({
    token: updated,
    secret,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE,
  });
  jar.set(cookieName, token, sessionCookieOptions());

  await new AuditService(prisma).log({
    ctx: { ...ctx, storeId, role, permissions },
    action: "STORE_SWITCHED",
    entity: "Store",
    entityId: storeId,
    before: { storeId: ctx.storeId },
    after: { storeId },
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ storeId, role, permissions });
});