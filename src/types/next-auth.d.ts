import type { DefaultSession } from "next-auth";

// next-auth v5 reexporta Session de @auth/core/types: o augmentation precisa
// atacar os dois módulos para valer no callbacks.session e no auth() do RSC.
type AppSessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  tenantId: string;
  storeId: string | null;
  role: string;
  permissions: string[];
};

declare module "@auth/core/types" {
  interface Session {
    user: AppSessionUser;
  }
}

declare module "next-auth" {
  interface Session {
    user: AppSessionUser & DefaultSession["user"];
  }
}