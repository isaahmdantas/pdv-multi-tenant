import { PERMISSIONS } from "@/modules/iam/permissions";

const PERMISSION_SET = new Set<string>(PERMISSIONS);

export function isValidPermissionCode(code: string): boolean {
  return PERMISSION_SET.has(code);
}