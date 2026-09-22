"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

export function CashRegisterCreateForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/cash-registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, name }),
      });
      if (res.ok) {
        setName("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar caixa.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Novo caixa
      </h2>
      <div className="space-y-1.5">
        <label htmlFor="cash-register-name" className="text-sm font-medium">
          Nome *
        </label>
        <input
          id="cash-register-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Caixa 01"
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Criando..." : "Criar caixa"}
      </Button>
    </form>
  );
}