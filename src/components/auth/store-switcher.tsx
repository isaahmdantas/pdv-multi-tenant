"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface StoreOption {
  storeId: string;
  name: string;
  code: string;
}

export function StoreSwitcher({
  stores,
  currentStoreId,
}: {
  stores: StoreOption[];
  currentStoreId: string | null;
}) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(
    currentStoreId ?? (stores[0]?.storeId ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (stores.length === 0) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/session/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Não foi possível trocar de unidade.");
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="store" className="text-xs font-medium text-muted-foreground">
          Unidade de trabalho
        </label>
        <select
          id="store"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {stores.map((s) => (
            <option key={s.storeId} value={s.storeId}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" disabled={loading || !storeId}>
        {loading ? "Trocando..." : "Trocar unidade"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}