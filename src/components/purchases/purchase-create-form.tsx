"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

type ItemRow = {
  key: number;
  productId: string;
  quantity: string;
  unitOfMeasureId: string;
  unitCost: string;
  batchNumber: string;
  expiryDate: string;
};

export function PurchaseCreateForm({
  stores,
  suppliers,
  products,
  units,
}: {
  stores: Option[];
  suppliers: Option[];
  products: Option[];
  units: Option[];
}) {
  const router = useRouter();
  const [storeId, setStoreId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { key: 1, productId: "", quantity: "", unitOfMeasureId: "", unitCost: "", batchNumber: "", expiryDate: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(key: number, field: keyof ItemRow, value: string) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addItem() {
    setItems((rows) => [
      ...rows,
      { key: Date.now(), productId: "", quantity: "", unitOfMeasureId: "", unitCost: "", batchNumber: "", expiryDate: "" },
    ]);
  }

  function removeItem(key: number) {
    setItems((rows) => rows.filter((r) => r.key !== key));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payloadItems = items
        .filter((i) => i.productId && i.quantity && i.unitCost)
        .map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitOfMeasureId: i.unitOfMeasureId || null,
          unitCost: i.unitCost,
          batchNumber: i.batchNumber || null,
          expiryDate: i.expiryDate ? `${i.expiryDate}T12:00:00.000Z` : null,
        }));
      if (payloadItems.length === 0) {
        setError("Adicione ao menos um item com produto, quantidade e custo.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/v1/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: storeId || null,
          supplierId: supplierId || null,
          notes: notes || null,
          expectedAt: expectedAt ? `${expectedAt}T12:00:00.000Z` : null,
          items: payloadItems,
        }),
      });
      if (res.ok) {
        setStoreId("");
        setSupplierId("");
        setNotes("");
        setExpectedAt("");
        setItems([
          { key: Date.now(), productId: "", quantity: "", unitOfMeasureId: "", unitCost: "", batchNumber: "", expiryDate: "" },
        ]);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar pedido de compra.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="purchase-store" className="text-sm font-medium">
            Unidade *
          </label>
          <select
            id="purchase-store"
            required
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione a unidade</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="purchase-supplier" className="text-sm font-medium">
            Fornecedor
          </label>
          <select
            id="purchase-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sem fornecedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="purchase-expected" className="text-sm font-medium">
            Previsão de entrega
          </label>
          <input
            id="purchase-expected"
            type="date"
            value={expectedAt}
            onChange={(e) => setExpectedAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="purchase-notes" className="text-sm font-medium">
            Observações
          </label>
          <input
            id="purchase-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            placeholder="Condições de pagamento, frete..."
          />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((row, idx) => (
          <div key={row.key} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Item {idx + 1}
              </p>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeItem(row.key)}
                  className="text-xs text-destructive"
                >
                  Remover
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <label htmlFor={`item-${row.key}-product`} className="text-sm font-medium">
                  Produto *
                </label>
                <select
                  id={`item-${row.key}-product`}
                  required
                  value={row.productId}
                  onChange={(e) => updateItem(row.key, "productId", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione um produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`item-${row.key}-qty`} className="text-sm font-medium">
                  Quantidade *
                </label>
                <input
                  id={`item-${row.key}-qty`}
                  required
                  type="text"
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(e) => updateItem(row.key, "quantity", e.target.value)}
                  className={inputClass}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`item-${row.key}-unit`} className="text-sm font-medium">
                  Unidade
                </label>
                <select
                  id={`item-${row.key}-unit`}
                  value={row.unitOfMeasureId}
                  onChange={(e) => updateItem(row.key, "unitOfMeasureId", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Unidade base</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`item-${row.key}-cost`} className="text-sm font-medium">
                  Custo unitário (R$) *
                </label>
                <input
                  id={`item-${row.key}-cost`}
                  required
                  type="text"
                  inputMode="decimal"
                  value={row.unitCost}
                  onChange={(e) => updateItem(row.key, "unitCost", e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`item-${row.key}-batch`} className="text-sm font-medium">
                  Lote
                </label>
                <input
                  id={`item-${row.key}-batch`}
                  value={row.batchNumber}
                  onChange={(e) => updateItem(row.key, "batchNumber", e.target.value)}
                  className={inputClass}
                  placeholder="LOTE-001"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`item-${row.key}-expiry`} className="text-sm font-medium">
                  Validade
                </label>
                <input
                  id={`item-${row.key}-expiry`}
                  type="date"
                  value={row.expiryDate}
                  onChange={(e) => updateItem(row.key, "expiryDate", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm text-primary">
          + Adicionar item
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Criar pedido de compra"}
      </Button>
    </form>
  );
}