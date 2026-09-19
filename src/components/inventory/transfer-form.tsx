"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };
type TransferRow = { productId: string; quantity: string; unitOfMeasureId: string };

export function TransferForm({
  stores,
  products,
  units,
}: {
  stores: Option[];
  products: Option[];
  units: Option[];
}) {
  const router = useRouter();
  const [destinationStoreId, setDestinationStoreId] = useState("");
  const [rows, setRows] = useState<TransferRow[]>([
    { productId: "", quantity: "", unitOfMeasureId: "" },
  ]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateRow(index: number, patch: Partial<TransferRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: "", quantity: "", unitOfMeasureId: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationStoreId,
          items: rows.map((r) => ({
            productId: r.productId,
            quantity: r.quantity,
            unitOfMeasureId: r.unitOfMeasureId || null,
          })),
          reason: reason || null,
        }),
      });
      if (res.ok) {
        setDestinationStoreId("");
        setRows([{ productId: "", quantity: "", unitOfMeasureId: "" }]);
        setReason("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar transferência.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="transfer-dest" className="text-sm font-medium">
          Unidade de destino *
        </label>
        <select
          id="transfer-dest"
          required
          value={destinationStoreId}
          onChange={(e) => setDestinationStoreId(e.target.value)}
          className={inputClass}
        >
          <option value="">Selecione a unidade de destino</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Itens da transferência</p>
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <select
              required
              aria-label="Produto"
              value={row.productId}
              onChange={(e) => updateRow(index, { productId: e.target.value })}
              className={inputClass}
            >
              <option value="">Produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              required
              aria-label="Quantidade"
              type="text"
              inputMode="decimal"
              value={row.quantity}
              onChange={(e) => updateRow(index, { quantity: e.target.value })}
              className={inputClass}
              placeholder="Qtd"
            />
            <select
              aria-label="Unidade"
              value={row.unitOfMeasureId}
              onChange={(e) => updateRow(index, { unitOfMeasureId: e.target.value })}
              className={inputClass}
            >
              <option value="">Base</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeRow(index)}
              disabled={rows.length === 1}
            >
              Remover
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Adicionar item
        </Button>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="transfer-reason" className="text-sm font-medium">
          Motivo
        </label>
        <input
          id="transfer-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClass}
          placeholder="Abastecimento de filial"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Transferindo..." : "Criar transferência"}
      </Button>
    </form>
  );
}