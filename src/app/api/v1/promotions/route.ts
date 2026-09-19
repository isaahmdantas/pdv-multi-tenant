import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createPromotionSchema } from "@/modules/pricing/schemas";
import { PromotionService } from "@/modules/pricing/services/promotion-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const includeInactive = next.nextUrl.searchParams.get("includeInactive") === "true";
  const promotions = await new PromotionService(prisma).list(ctx, { includeInactive });
  return NextResponse.json({ promotions });
});

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

  const parsed = createPromotionSchema.safeParse(body);
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

  const created = await new PromotionService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ promotion: created }, { status: 201 });
}, "pricing.manage");