import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createPriceTableSchema } from "@/modules/pricing/schemas";
import { PriceTableService } from "@/modules/pricing/services/price-table-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const includeInactive = next.nextUrl.searchParams.get("includeInactive") === "true";
  const priceTables = await new PriceTableService(prisma).list(ctx, { includeInactive });
  return NextResponse.json({ priceTables });
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

  const parsed = createPriceTableSchema.safeParse(body);
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

  const created = await new PriceTableService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ priceTable: created }, { status: 201 });
}, "pricing.manage");