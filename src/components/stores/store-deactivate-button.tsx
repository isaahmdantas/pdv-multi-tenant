"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function StoreDeactivateButton({
  storeId,
  storeName,
}: {
  storeId: string;
  storeName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDeactivate() {
    if (!window.confirm(`Desativar a unidade "${storeName}"?`)) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/stores/${storeId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(body?.error?.message ?? "Falha ao desativar unidade.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDeactivate}
        disabled={loading}
      >
        {loading ? "Desativando..." : "Desativar"}
      </Button>
    </div>
  );
}