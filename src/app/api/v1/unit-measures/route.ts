import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createUnitMeasureSchema } from "@/modules/products/schemas";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx) => {
  const unitMeasures = await new UnitMeasureService(prisma).list(ctx);
  return NextResponse.json({ unitMeasures });
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

  const parsed = createUnitMeasureSchema.safeParse(body);
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

  const created = await new UnitMeasureService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ unitMeasure: created }, { status: 201 });
}, "products.create");