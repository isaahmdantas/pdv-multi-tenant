import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createSupplierSchema } from "@/modules/purchases/schemas";
import { SupplierService } from "@/modules/purchases/services/supplier-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const search = next.nextUrl.searchParams.get("search") ?? undefined;
  const includeInactive = next.nextUrl.searchParams.get("includeInactive") === "true";
  const suppliers = await new SupplierService(prisma).list(ctx, { includeInactive, search });
  return NextResponse.json({ suppliers });
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

  const parsed = createSupplierSchema.safeParse(body);
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

  const created = await new SupplierService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ supplier: created }, { status: 201 });
}, "purchases.manage");