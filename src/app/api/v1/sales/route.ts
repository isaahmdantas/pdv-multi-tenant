import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { SaleService } from "@/modules/sales/services/sale-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";
import { createSaleSchema, saleQuerySchema } from "@/modules/sales/schemas";

const saleService = new SaleService(prisma);

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

  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const sale = await saleService.checkout(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ sale }, { status: 201 });
}, "sales.create");

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

  const sales = await saleService.list(ctx, parsed.data);
  return NextResponse.json({ sales });
}, "reports.view");