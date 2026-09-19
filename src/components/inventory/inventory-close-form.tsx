"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

export type CloseItem = {
  productId: string;
  productName: string;
  sku: string;
  expected: string;
};

export function InventoryCloseForm({ inventoryId, items }: { inventoryId: string; items: CloseItem[] }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.productId, i.expected])),
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/counts/${inventoryId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, countedQuantity: counts[i.productId] ?? "0" })),
          notes: notes || null,
        }),
      });
      if (res.ok) {
        setNotes("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao encerrar inventário.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <ul className="space-y-2">
        {items.map((i) => {
          const expected = i.expected;
          const counted = counts[i.productId] ?? "0";
          const diff =
            expected !== "" && counted !== ""
              ? (Number(counted) - Number(expected)).toFixed(4)
              : "";
          return (
            <li key={i.productId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {i.productName}
                  <span className="font-mono text-xs text-muted-foreground"> ({i.sku})</span>
                </p>
                <p className="text-xs text-muted-foreground">esperado: {expected}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={counted}
                  onChange={(e) =>
                    setCounts((prev) => ({ ...prev, [i.productId]: e.target.value }))
                  }
                  className={`${inputClass} w-24 text-right font-mono`}
                  aria-label={`Contagem de ${i.productName}`}
                />
                <span className="w-20 text-right font-mono text-xs text-muted-foreground">
                  {diff === "0.0000" ? "ok" : diff}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5">
        <label htmlFor="inventory-close-notes" className="text-sm font-medium">
          Observações
        </label>
        <input
          id="inventory-close-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          placeholder="Divergências encontradas"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Encerrando..." : "Encerrar inventário"}
      </Button>
    </form>
  );
}