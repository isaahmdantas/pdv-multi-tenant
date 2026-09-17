"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          tenantSlug: tenantSlug.trim() || null,
        }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao entrar.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="voce@empresa.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tenantSlug" className="text-sm font-medium">
          Slug do tenant (opcional)
        </label>
        <input
          id="tenantSlug"
          type="text"
          autoComplete="organization"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          className={inputClass}
          placeholder="loja-demo"
        />
        <p className="text-xs text-muted-foreground">
          Necessário apenas quando o e-mail existe em mais de um tenant.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}