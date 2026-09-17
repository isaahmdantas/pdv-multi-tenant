import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres@localhost:5432/pdv_test?schema=public";

export function createTestDb(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL });
  return new PrismaClient({ adapter });
}