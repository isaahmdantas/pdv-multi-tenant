import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { openInventorySchema } from "@/modules/inventory/schemas";
import { InventoryService } from "@/modules/inventory/services/inventory-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx, request) => {
  const next = request as NextRequest;
  const storeId = next.nextUrl.searchParams.get("storeId") ?? ctx.storeId ?? undefined;
  const includeClosed = next.nextUrl.searchParams.get("includeClosed") === "true";
  const inventories = await new InventoryService(prisma).list(ctx, storeId, includeClosed);
  return NextResponse.json({ inventories });
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

  const parsed = openInventorySchema.safeParse(body);
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
  const inventory = await new InventoryService(prisma).open(ctx, storeId, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ inventory }, { status: 201 });
}, "inventory.adjust");