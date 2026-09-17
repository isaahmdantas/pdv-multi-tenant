"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSignOut() {
    setLoading(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={onSignOut} disabled={loading}>
      {loading ? "Saindo..." : "Sair"}
    </Button>
  );
}