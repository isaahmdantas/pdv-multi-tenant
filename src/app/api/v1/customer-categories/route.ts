import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { createCustomerCategorySchema } from "@/modules/customers/schemas";
import { CustomerCategoryService } from "@/modules/customers/services/customer-category-service";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/api/rate-limit";

export const GET = withApiGuards(async (ctx) => {
  const categories = await new CustomerCategoryService(prisma).list(ctx);
  return NextResponse.json({ categories });
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

  const parsed = createCustomerCategorySchema.safeParse(body);
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

  const created = await new CustomerCategoryService(prisma).create(ctx, parsed.data, {
    ip: clientIp(request),
    device: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ category: created }, { status: 201 });
}, "customers.manage");