// Helpers do cookie de sessão do Auth.js (F3-04).
// O cookie precisa ter o MESMO nome/opções que o @auth/core usa, para que
// encode/getToken/decode conversem com o middleware e com getSessionContext.
// Nome com prefixo __Secure- somente em HTTPS (AUTH_URL https).

export const SESSION_COOKIE_INSECURE = "authjs.session-token";
export const SESSION_COOKIE_SECURE = "__Secure-authjs.session-token";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não definido. Gere com: openssl rand -base64 32");
  }
  return secret;
}

export function authUseSecureCookies(): boolean {
  const explicit = process.env.AUTH_SECURE_COOKIE;
  if (explicit) return explicit === "true";
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  return url.startsWith("https:");
}

export function sessionTokenCookieName(): string {
  return authUseSecureCookies() ? SESSION_COOKIE_SECURE : SESSION_COOKIE_INSECURE;
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

export function sessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: authUseSecureCookies(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}