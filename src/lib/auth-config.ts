import type { NextAuthConfig } from "next-auth";

/**
 * F3-02/03/04: config do Auth.js v5 — JWT strategy + cookie httpOnly.
 * O login real é feito em POST /api/v1/auth/login (contrato da API); o
 * middleware (proxy) usa esta config apenas para validar/proteger rotas e
 * expor a sessão. O token é assinado com o MESMO secret+salt (nome do cookie).
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    // F3-04: propaga tenantId/storeId/role/permissions do JWT para a sessão.
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string | undefined) ?? "";
        session.user.name = (token.name as string | null | undefined) ?? null;
        session.user.email = (token.email as string | undefined) ?? "";
        session.user.image = (token.picture as string | null | undefined) ?? null;
        session.user.tenantId = (token.tenantId as string | undefined) ?? "";
        session.user.storeId = (token.storeId as string | null | undefined) ?? null;
        session.user.role = (token.role as string | undefined) ?? "NONE";
        session.user.permissions = Array.isArray(token.permissions)
          ? (token.permissions as string[])
          : [];
      }
      return session;
    },
    // F3-07: controle de acesso das rotas protegidas.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      // Páginas públicas.
      if (pathname === "/" || pathname === "/login") {
        if (isLoggedIn && pathname === "/login") {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;