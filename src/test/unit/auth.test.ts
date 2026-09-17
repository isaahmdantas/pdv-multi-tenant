import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encode, decode } from "next-auth/jwt";
import {
  authSecret,
  authUseSecureCookies,
  sessionTokenCookieName,
  sessionCookieOptions,
  SESSION_COOKIE_SECURE,
  SESSION_COOKIE_INSECURE,
} from "@/lib/session-cookies";
import { getSessionContext } from "@/lib/session";
import { rateLimit, clientIp, rateLimitedResponse } from "@/lib/api/rate-limit";
import { isValidPermissionCode } from "@/modules/iam/schema-validation";

const SECRET = "unit-test-secret-0123456789abcdef0123456789abcdef";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session-cookies", () => {
  it("sem AUTH_URL em https usa cookie inseguro", () => {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    expect(authUseSecureCookies()).toBe(false);
    expect(sessionTokenCookieName()).toBe(SESSION_COOKIE_INSECURE);
    expect(sessionCookieOptions().secure).toBe(false);
  });

  it("com AUTH_URL https usa cookie com prefixo __Secure-", () => {
    vi.stubEnv("AUTH_URL", "https://app.exemplo.com");
    expect(authUseSecureCookies()).toBe(true);
    expect(sessionTokenCookieName()).toBe(SESSION_COOKIE_SECURE);
    expect(sessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  });

  it("AUTH_SECURE_COOKIE explícito vence a inferência por URL", () => {
    vi.stubEnv("AUTH_URL", "https://app.exemplo.com");
    vi.stubEnv("AUTH_SECURE_COOKIE", "false");
    expect(authUseSecureCookies()).toBe(false);
  });

  it("authSecret lança sem AUTH_SECRET/NEXTAUTH_SECRET", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => authSecret()).toThrow(/AUTH_SECRET/);
  });
});

describe("JWT roundtrip (salt = nome do cookie)", () => {
  it("encode/decode preserva o payload", async () => {
    const payload = {
      sub: "user-1",
      name: "Carol",
      email: "carol@x.local",
      tenantId: "tenant-a",
      storeId: null,
      role: "ADMIN",
      permissions: ["sales.create", "settings.manage"],
    };
    const token = await encode({
      token: payload,
      secret: SECRET,
      salt: SESSION_COOKIE_INSECURE,
    });
    const decoded = await decode({
      token,
      secret: SECRET,
      salt: SESSION_COOKIE_INSECURE,
    });
    expect(decoded).toMatchObject({
      sub: "user-1",
      tenantId: "tenant-a",
      storeId: null,
      role: "ADMIN",
      permissions: ["sales.create", "settings.manage"],
    });
  });

  it("decode falha com secret errado", async () => {
    const token = await encode({
      token: { sub: "u1", tenantId: "t1" },
      secret: SECRET,
      salt: SESSION_COOKIE_INSECURE,
    });
    await expect(
      decode({ token, secret: "outro-secret", salt: SESSION_COOKIE_INSECURE }),
    ).rejects.toThrow(/no matching decryption secret/);
  });
});

describe("getSessionContext", () => {
  it("mapeia JWT do cookie para TenantContext", async () => {
    const token = await encode({
      token: {
        sub: "user-c",
        tenantId: "tenant-a",
        storeId: "store-1",
        role: "OPERADOR",
        permissions: ["sales.create"],
      },
      secret: SECRET,
      salt: SESSION_COOKIE_INSECURE,
    });
    const request = new Request("http://localhost/session", {
      headers: { cookie: `${SESSION_COOKIE_INSECURE}=${token}` },
    });
    const ctx = await getSessionContext(request);
    expect(ctx).toEqual({
      tenantId: "tenant-a",
      userId: "user-c",
      storeId: "store-1",
      role: "OPERADOR",
      permissions: ["sales.create"],
    });
  });

  it("retorna null sem cookie de sessão", async () => {
    const request = new Request("http://localhost/session");
    expect(await getSessionContext(request)).toBeNull();
  });

  it("storeId vazio vira null", async () => {
    const token = await encode({
      token: { sub: "user-c", tenantId: "tenant-a", storeId: "", role: "NONE", permissions: [] },
      secret: SECRET,
      salt: SESSION_COOKIE_INSECURE,
    });
    const request = new Request("http://localhost/session", {
      headers: { cookie: `${SESSION_COOKIE_INSECURE}=${token}` },
    });
    const ctx = await getSessionContext(request);
    expect(ctx?.storeId).toBeNull();
  });
});

describe("rate-limit", () => {
  it("bloqueia após o limite e calcula retryAfterSeconds", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("auth:login:test", { limit: 3, windowMs: 60_000 }).ok).toBe(true);
    }
    const blocked = rateLimit("auth:login:test", { limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("janelas distintas não interferem", () => {
    expect(rateLimit("a", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit("b", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("clientIp usa x-forwarded-for em primeiro lugar", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    expect(clientIp(req)).toBe("10.0.0.1");
  });

  it("rateLimitedResponse devolve 429 com Retry-After", () => {
    const res = rateLimitedResponse(30);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});

describe("schema-validation", () => {
  it("isValidPermissionCode aceita códigos reais e rejeita inventados", () => {
    expect(isValidPermissionCode("sales.create")).toBe(true);
    expect(isValidPermissionCode("nope.inventado")).toBe(false);
  });
});