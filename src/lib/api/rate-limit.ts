import { NextResponse } from "next/server";

type Bucket = { hits: number[] };

// Rate limit in-memory (MVP, janela deslizante). Em multi-instância/produção
// substituir por store compartilhada (Redis). Keys por IP+recurso.
const buckets = new Map<string, Bucket>();
const ERROR_MESSAGE = "Muitas tentativas. Aguarde e tente novamente.";

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(
  key: string,
  opts: { limit?: number; windowMs?: number } = {},
): { ok: boolean; retryAfterSeconds: number } {
  const { limit = 10, windowMs = 60_000 } = opts;
  const now = Date.now();

  // Limpeza ocasional para não crescer sem limite.
  if (Math.random() < 0.01 && buckets.size > 1000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0]!;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  return { ok: true, retryAfterSeconds: 0 };
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: ERROR_MESSAGE,
        details: { retryAfterSeconds },
      },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}