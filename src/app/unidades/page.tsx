import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreService } from "@/modules/stores/services/store-service";
import { StoreCreateForm } from "@/components/stores/store-create-form";
import { StoreDeactivateButton } from "@/components/stores/store-deactivate-button";

export const metadata: Metadata = {
  title: "Unidades | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function UnidadesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!user.permissions.includes("settings.manage")) redirect("/dashboard");

  const ctx = {
    tenantId: user.tenantId,
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    permissions: user.permissions,
  };
  const stores = await new StoreService(prisma).list(ctx);
  const active = stores.filter((s) => s.status === "ACTIVE");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Unidades</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as unidades da empresa (lojas, matriz, filiais).
        </p>
      </header>

      <StoreCreateForm />

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Unidades ativas ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma unidade cadastrada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {s.code}
                  </p>
                </div>
                <StoreDeactivateButton storeId={s.id} storeName={s.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}