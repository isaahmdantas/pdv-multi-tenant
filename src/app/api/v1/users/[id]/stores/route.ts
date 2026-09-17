import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { grantUserStoreSchema } from "@/modules/iam/schemas";
import { UserStoreService } from "@/modules/iam/services/user-store-service";
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

    const parsed = grantUserStoreSchema.safeParse(body);
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

    const created = await new UserStoreService(prisma).grant(ctx, id, parsed.data, {
      ip: clientIp(request),
      device: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ userStore: created }, { status: 201 });
  },
  "settings.manage",
);