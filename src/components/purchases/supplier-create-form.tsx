"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed";

export function SupplierCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          document: document || null,
          email: email || null,
          phone: phone || null,
          city: city || null,
          state: state || null,
        }),
      });
      if (res.ok) {
        setName("");
        setDocument("");
        setEmail("");
        setPhone("");
        setCity("");
        setState("");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao cadastrar fornecedor.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="supplier-name" className="text-sm font-medium">
          Nome / Razão social *
        </label>
        <input
          id="supplier-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Atacadão Central"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="supplier-document" className="text-sm font-medium">
          CNPJ / CPF
        </label>
        <input
          id="supplier-document"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          className={inputClass}
          placeholder="12.345.678/0001-95"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="supplier-email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="supplier-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="vendas@fornecedor.com.br"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="supplier-phone" className="text-sm font-medium">
          Telefone
        </label>
        <input
          id="supplier-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          placeholder="(11) 4000-0000"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="supplier-city" className="text-sm font-medium">
          Cidade
        </label>
        <input
          id="supplier-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={inputClass}
          placeholder="São Paulo"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="supplier-state" className="text-sm font-medium">
          UF
        </label>
        <input
          id="supplier-state"
          value={state}
          maxLength={2}
          onChange={(e) => setState(e.target.value.toUpperCase())}
          className={inputClass}
          placeholder="SP"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Cadastrar fornecedor"}
        </Button>
      </div>
    </form>
  );
}