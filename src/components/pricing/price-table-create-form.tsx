"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function PriceTableCreateForm({
  stores,
  categories,
}: {
  stores: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [storeId, setStoreId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [priority, setPriority] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/price-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          storeId: storeId || null,
          customerCategoryId: categoryId || null,
          defaultPrice: defaultPrice || "0",
          priority: priority === "" ? 0 : Number(priority),
        }),
      });
      if (res.ok) {
        setName("");
        setDescription("");
        setStoreId("");
        setCategoryId("");
        setDefaultPrice("");
        setPriority("0");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar tabela de preço.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Nova tabela de preço
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="price-table-name" className="text-sm font-medium">
            Nome *
          </label>
          <input
            id="price-table-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Tabela Varejo"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="price-table-store" className="text-sm font-medium">
            Unidade
          </label>
          <select
            id="price-table-store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className={inputClass}
          >
            <option value="">Todas as unidades</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="price-table-category" className="text-sm font-medium">
            Categoria de cliente
          </label>
          <select
            id="price-table-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="price-table-default" className="text-sm font-medium">
            Preço padrão (R$)
          </label>
          <input
            id="price-table-default"
            type="text"
            inputMode="decimal"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="price-table-priority" className="text-sm font-medium">
            Prioridade
          </label>
          <input
            id="price-table-priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="price-table-description" className="text-sm font-medium">
            Descrição
          </label>
          <input
            id="price-table-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Preços praticados no balcão"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Criando..." : "Criar tabela"}
      </Button>
    </form>
  );
}