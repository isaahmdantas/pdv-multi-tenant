import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { prisma } from "@/lib/prisma";
import { saleService } from "@/modules/sales/services/sale-service";
import { createSaleSchema, saleQuerySchema } from "@/modules/sales/schemas";

const service = saleService(prisma);

export const POST = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  let body: unknown;
  try {
    body = await next.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Corpo inválido" } },
      { status: 400 },
    );
  }

  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const result = await service.checkout(ctx, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status: result.status ?? 400 },
    );
  }

  return NextResponse.json(
    { sale: result.sale, created: result.created },
    { status: result.created ? 201 : 200 },
  );
});

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const storeId = next.nextUrl.searchParams.get("storeId") ?? ctx.storeId ?? undefined;
  const status = next.nextUrl.searchParams.get("status") ?? undefined;
  const cashSessionId = next.nextUrl.searchParams.get("cashSessionId") ?? undefined;
  const fromDate = next.nextUrl.searchParams.get("fromDate") ? new Date(next.nextUrl.searchParams.get("fromDate")!) : undefined;
  const toDate = next.nextUrl.searchParams.get("toDate") ? new Date(next.nextUrl.searchParams.get("toDate")!) : undefined;

  const parsed = saleQuerySchema.safeParse({ storeId, status, cashSessionId, fromDate, toDate });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Parâmetros inválidos", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const sales = await service.list(ctx, parsed.data);
  return NextResponse.json({ sales });
});
