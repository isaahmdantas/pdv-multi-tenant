"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PurchaseActions({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [action, setAction] = useState<"receive" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onReceive() {
    if (!window.confirm("Registrar a entrada deste pedido? O estoque será atualizado.")) return;
    setAction("receive");
    setError(null);
    try {
      const res = await fetch(`/api/v1/purchases/${purchaseId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Falha ao registrar a entrada.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setAction(null);
    }
  }

  async function onCancel() {
    if (!window.confirm("Cancelar este pedido de compra?")) return;
    setAction("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/v1/purchases/${purchaseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Falha ao cancelar o pedido.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setAction(null);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={onReceive} disabled={action !== null}>
        {action === "receive" ? "Entrando..." : "Receber entrada"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive"
        onClick={onCancel}
        disabled={action !== null}
      >
        {action === "cancel" ? "Cancelando..." : "Cancelar"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}