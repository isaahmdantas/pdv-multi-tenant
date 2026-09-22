import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CashRegisterService } from "@/modules/stores/services/cash-register-service";
import { StoreService } from "@/modules/stores/services/store-service";
import { CashRegisterCreateForm } from "@/components/stores/cash-register-create-form";
import { CashRegisterDeactivateButton } from "@/components/stores/cash-register-deactivate-button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Caixas | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function CaixasPage() {
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

  const [stores, registers] = await Promise.all([
    new StoreService(prisma).list(ctx),
    new CashRegisterService(prisma).list(ctx, user.storeId ?? undefined),
  ]);

  const activeStores = stores.filter((s) => s.status === "ACTIVE");
  const currentStore = activeStores.find((s) => s.id === user.storeId);

  return (
    <PageContainer>
      <PageHeader
        title="Caixas"
        description="Gerencie os caixas (PDVs) de cada unidade."
      />

      {currentStore ? (
        <CashRegisterCreateForm storeId={currentStore.id} />
      ) : (
        <div className="rounded-lg border bg-destructive/10 p-4 text-destructive text-sm">
          Selecione uma unidade ativa no seletor de unidade para gerenciar caixas.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Caixas
            {currentStore && <span>{" "}({currentStore.name})</span>}
            {" "}({registers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {registers.length === 0 ? (
            <EmptyState
              title="Nenhum caixa cadastrado"
              description="Crie caixas para poder abrir sessões de caixa."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {registers.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {r.store?.code ?? "—"}
                    </p>
                  </div>
                  <CashRegisterDeactivateButton
                    registerId={r.id}
                    registerName={r.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}