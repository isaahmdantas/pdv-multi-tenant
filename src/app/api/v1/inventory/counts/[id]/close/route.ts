import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { closeInventorySchema } from "@/modules/inventory/schemas";
import { InventoryService } from "@/modules/inventory/services/inventory-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const POST = withApiGuards(
  async (ctx, request, routeCtx: { params: Promise<{ id: string }> }) => {
    const { id } = await routeCtx.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
        { status: 400 },
      );
    }

    const parsed = closeInventorySchema.safeParse(body);
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

    const closed = await new InventoryService(prisma).close(ctx, id, parsed.data, {
      ip: clientIp(request),
      device: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ inventory: closed });
  },
  "inventory.adjust",
);