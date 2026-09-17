"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function ProductCreateForm({
  categories,
  units,
}: {
  categories: Option[];
  units: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [basePrice, setBasePrice] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [baseUnitId, setBaseUnitId] = useState("");
  const [barcodes, setBarcodes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const parsed = barcodes
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b.length > 0);
      const res = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          basePrice: basePrice || "0",
          categoryId: categoryId || null,
          baseUnitId,
          barcodes: parsed.length > 0 ? parsed : undefined,
        }),
      });
      if (res.ok) {
        setName("");
        setSku("");
        setBasePrice("0");
        setCategoryId("");
        setBaseUnitId("");
        setBarcodes("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar produto.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Novo produto
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="product-name" className="text-sm font-medium">
            Nome *
          </label>
          <input
            id="product-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Refrigerante Lata 350ml"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="product-sku" className="text-sm font-medium">
            SKU *
          </label>
          <input
            id="product-sku"
            required
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className={inputClass}
            placeholder="REF-001"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="product-price" className="text-sm font-medium">
            Preço base (R$)
          </label>
          <input
            id="product-price"
            type="text"
            inputMode="decimal"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="product-unit" className="text-sm font-medium">
            Unidade de medida *
          </label>
          <select
            id="product-unit"
            required
            value={baseUnitId}
            onChange={(e) => setBaseUnitId(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecione...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="product-category" className="text-sm font-medium">
            Categoria
          </label>
          <select
            id="product-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="product-barcodes" className="text-sm font-medium">
            Códigos de barras
          </label>
          <input
            id="product-barcodes"
            value={barcodes}
            onChange={(e) => setBarcodes(e.target.value)}
            className={inputClass}
            placeholder="7891000101010, 7891000101011"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Criando..." : "Criar produto"}
      </Button>
    </form>
  );
}