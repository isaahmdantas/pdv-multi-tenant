"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

type Option = { id: string; label: string };

export function CustomerCreateForm({
  categories,
}: {
  categories: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creditLimit, setCreditLimit] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          document: document || null,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          customerCategoryId: categoryId || null,
          creditLimit: creditLimit || "0",
        }),
      });
      if (res.ok) {
        setName("");
        setDocument("");
        setEmail("");
        setPhone("");
        setNotes("");
        setCategoryId("");
        setCreditLimit("0");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao criar cliente.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Novo cliente
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="customer-name" className="text-sm font-medium">
            Nome *
          </label>
          <input
            id="customer-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Maria Oliveira"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-document" className="text-sm font-medium">
            Documento (CPF/CNPJ)
          </label>
          <input
            id="customer-document"
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            className={inputClass}
            placeholder="00000000000"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="customer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="cliente@exemplo.com"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-phone" className="text-sm font-medium">
            Telefone
          </label>
          <input
            id="customer-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-category" className="text-sm font-medium">
            Categoria
          </label>
          <select
            id="customer-category"
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
          <label htmlFor="customer-credit-limit" className="text-sm font-medium">
            Limite de crédito (R$)
          </label>
          <input
            id="customer-credit-limit"
            type="text"
            inputMode="decimal"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="customer-notes" className="text-sm font-medium">
            Observações
          </label>
          <textarea
            id="customer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            placeholder="Anotações sobre o cliente"
            rows={3}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-3">
        {loading ? "Criando..." : "Criar cliente"}
      </Button>
    </form>
  );
}
