"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SupplierDeactivateButton({ supplierId, name }: { supplierId: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDeactivate() {
    if (!window.confirm(`Desativar o fornecedor "${name}"?`)) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/suppliers/${supplierId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao desativar fornecedor.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDeactivate}
        disabled={loading}
        className="text-destructive"
      >
        {loading ? "..." : "Desativar"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}