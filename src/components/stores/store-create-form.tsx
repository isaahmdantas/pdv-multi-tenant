"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

export function StoreCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, city: city.trim() || null, state: state.trim() || null }),
      });
      if (res.ok) {
        setName("");
        setCode("");
        setCity("");
        setState("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar unidade.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Nova unidade
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="store-name" className="text-sm font-medium">
            Nome *
          </label>
          <input
            id="store-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Filial Centro"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="store-code" className="text-sm font-medium">
            Código *
          </label>
          <input
            id="store-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
            placeholder="FILIAL-CENTRO"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="store-city" className="text-sm font-medium">
            Cidade
          </label>
          <input
            id="store-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClass}
            placeholder="São Paulo"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="store-state" className="text-sm font-medium">
            UF
          </label>
          <input
            id="store-state"
            value={state}
            maxLength={2}
            onChange={(e) => setState(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="SP"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Criando..." : "Criar unidade"}
      </Button>
    </form>
  );
}