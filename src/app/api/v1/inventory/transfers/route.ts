import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { stockTransferSchema } from "@/modules/inventory/schemas";
import { StockService } from "@/modules/inventory/services/stock-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx) => {
  const transfers = await new StockService(prisma).listTransfers(ctx);
  return NextResponse.json({ transfers });
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

  const parsed = stockTransferSchema.safeParse(body);
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

  const storeId =
    typeof body === "object" && body !== null && "storeId" in body
      ? (body as { storeId?: string }).storeId
      : undefined;
  const id = await new StockService(prisma).transfer(ctx, storeId, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ id }, { status: 201 });
}, "inventory.transfer");