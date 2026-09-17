import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSIONS, DEFAULT_ROLES } from "../src/modules/iam/permissions";
import { PasswordService } from "../src/modules/iam/password";

const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? "loja-demo";
const TENANT_NAME = process.env.SEED_TENANT_NAME ?? "Loja Demo";
const STORE_CODE = process.env.SEED_STORE_CODE ?? "MATRIZ";
const STORE_NAME = process.env.SEED_STORE_NAME ?? "Matriz";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@loja.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: { name: TENANT_NAME },
    create: { name: TENANT_NAME, slug: TENANT_SLUG },
  });

  const store = await prisma.store.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: STORE_CODE } },
    update: { name: STORE_NAME },
    create: { tenantId: tenant.id, name: STORE_NAME, code: STORE_CODE },
  });

  const permissionIds: Record<string, string> = {};
  for (const code of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: {},
      create: { tenantId: tenant.id, code },
    });
    permissionIds[code] = perm.id;
  }

  const roleIds: Record<string, string> = {};
  for (const def of Object.values(DEFAULT_ROLES)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: def.name } },
      update: { globalStoreAccess: def.globalStoreAccess, description: def.description },
      create: {
        tenantId: tenant.id,
        name: def.name,
        description: def.description,
        globalStoreAccess: def.globalStoreAccess,
      },
    });
    roleIds[def.name] = role.id;

    for (const code of def.permissions) {
      const permissionId = permissionIds[code];
      if (!permissionId) throw new Error(`Permissão desconhecida: ${code}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { tenantId: tenant.id, roleId: role.id, permissionId },
      });
    }
  }

  const adminRole = roleIds["ADMIN"];
  const existing = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: ADMIN_EMAIL },
  });

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const passwordHash = await PasswordService.hash(ADMIN_PASSWORD);
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, name: "Administrador", email: ADMIN_EMAIL, passwordHash },
    });
    userId = user.id;
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: adminRole } },
    update: {},
    create: { tenantId: tenant.id, userId, roleId: adminRole },
  });

  await prisma.userStore.upsert({
    where: { tenantId_userId_storeId: { tenantId: tenant.id, userId, storeId: store.id } },
    update: { storeRoleId: adminRole },
    create: { tenantId: tenant.id, userId, storeId: store.id, storeRoleId: adminRole },
  });

  const counts = {
    tenants: await prisma.tenant.count(),
    stores: await prisma.store.count({ where: { tenantId: tenant.id } }),
    users: await prisma.user.count({ where: { tenantId: tenant.id } }),
    roles: await prisma.role.count({ where: { tenantId: tenant.id } }),
    permissions: await prisma.permission.count({ where: { tenantId: tenant.id } }),
  };

  console.log("Seed concluído:");
  console.log({ tenant: tenant.slug, store: store.code, ...counts, admin: ADMIN_EMAIL });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});