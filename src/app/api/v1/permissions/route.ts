import { NextResponse } from "next/server";
import { withApiGuards } from "@/lib/api/guards";
import { PERMISSIONS } from "@/modules/iam/permissions";

export const GET = withApiGuards(async () => {
  return NextResponse.json({
    permissions: PERMISSIONS.map((code) => ({ code })),
  });
}, "settings.manage");