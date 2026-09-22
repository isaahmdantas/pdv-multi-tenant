"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

export function UnitMeasureCreateForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/unit-measures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      if (res.ok) {
        setCode("");
        setName("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar unidade de medida.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Nova unidade de medida
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="unit-measure-code" className="text-sm font-medium">
            Código *
          </label>
          <input
            id="unit-measure-code"
            required
            maxLength={10}
            value={code.toUpperCase()}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="UN"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="unit-measure-name" className="text-sm font-medium">
            Nome *
          </label>
          <input
            id="unit-measure-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Unidade"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Criando..." : "Criar unidade de medida"}
      </Button>
    </form>
  );
}