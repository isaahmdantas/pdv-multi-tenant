"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function PromotionCreateForm({
  stores,
  products,
  categories,
}: {
  stores: Option[];
  products: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [storeId, setStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType,
          discountValue,
          storeId: storeId || null,
          productId: productId || null,
          customerCategoryId: categoryId || null,
          validUntil: validUntil || null,
        }),
      });
      if (res.ok) {
        setDiscountValue("");
        setStoreId("");
        setProductId("");
        setCategoryId("");
        setValidUntil("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar promoção.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Nova promoção
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="promotion-type" className="text-sm font-medium">
            Tipo de desconto *
          </label>
          <select
            id="promotion-type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            className={inputClass}
          >
            <option value="PERCENTAGE">Porcentagem (%)</option>
            <option value="FIXED">Valor fixo (R$)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="promotion-value" className="text-sm font-medium">
            {discountType === "PERCENTAGE" ? "Desconto (%) *" : "Desconto (R$) *"}
          </label>
          <input
            id="promotion-value"
            type="text"
            inputMode="decimal"
            required
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className={inputClass}
            placeholder={discountType === "PERCENTAGE" ? "10" : "2.50"}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="promotion-product" className="text-sm font-medium">
            Produto
          </label>
          <select
            id="promotion-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={inputClass}
          >
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="promotion-store" className="text-sm font-medium">
            Unidade
          </label>
          <select
            id="promotion-store"
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
          <label htmlFor="promotion-category" className="text-sm font-medium">
            Categoria de cliente
          </label>
          <select
            id="promotion-category"
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
          <label htmlFor="promotion-valid-until" className="text-sm font-medium">
            Validade
          </label>
          <input
            id="promotion-valid-until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Criando..." : "Criar promoção"}
      </Button>
    </form>
  );
}