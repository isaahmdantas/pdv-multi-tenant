import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { updateUserStoreSchema } from "@/modules/iam/schemas";
import { UserStoreService } from "@/modules/iam/services/user-store-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const PUT = withApiGuards(
  async (
    ctx,
    request,
    routeCtx: { params: Promise<{ id: string; storeId: string }> },
  ) => {
    const { id, storeId } = await routeCtx.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Body JSON inválido" } },
        { status: 400 },
      );
    }

    const parsed = updateUserStoreSchema.safeParse(body);
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

    const updated = await new UserStoreService(prisma).update(ctx, id, storeId, parsed.data, {
      ip: clientIp(request),
      device: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ userStore: updated });
  },
  "settings.manage",
);

export const DELETE = withApiGuards(
  async (ctx, request, routeCtx: { params: Promise<{ id: string; storeId: string }> }) => {
    const { id, storeId } = await routeCtx.params;
    const result = await new UserStoreService(prisma).revoke(ctx, id, storeId, {
      ip: clientIp(request),
      device: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json(result);
  },
  "settings.manage",
);