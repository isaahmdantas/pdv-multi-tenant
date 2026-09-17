import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const result = await prisma.$queryRaw`SELECT 1 AS ok, current_database() AS db, version() AS v`;
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main();