import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import { loginSchema } from "@/modules/iam/schemas";
import { AuthenticationService } from "@/modules/iam/services/authentication-service";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api/errors";
import {
  authSecret,
  sessionTokenCookieName,
  sessionCookieOptions,
  SESSION_MAX_AGE,
} from "@/lib/session-cookies";
import { clientIp, rateLimit, rateLimitedResponse } from "@/lib/api/rate-limit";

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limit = rateLimit(`auth:login:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
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

  try {
    const result = await new AuthenticationService(prisma).login({
      ...parsed.data,
      ip,
      device: request.headers.get("user-agent") ?? undefined,
    });

    const session = {
      sub: result.userId,
      name: result.name,
      email: result.email,
      tenantId: result.tenantId,
      storeId: result.storeId,
      role: result.role,
      permissions: result.permissions,
    };

    const token = await encode({
      token: session,
      secret: authSecret(),
      salt: sessionTokenCookieName(),
      maxAge: SESSION_MAX_AGE,
    });

    const jar = await cookies();
    jar.set(sessionTokenCookieName(), token, sessionCookieOptions());

    return NextResponse.json({
      user: {
        id: result.userId,
        name: result.name,
        email: result.email,
        tenantId: result.tenantId,
        storeId: result.storeId,
        role: result.role,
        permissions: result.permissions,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.toJSON() }, { status: err.status });
    }
    throw err;
  }
}