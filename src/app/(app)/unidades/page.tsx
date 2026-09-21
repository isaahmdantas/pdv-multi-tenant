import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreService } from "@/modules/stores/services/store-service";
import { StoreCreateForm } from "@/components/stores/store-create-form";
import { StoreDeactivateButton } from "@/components/stores/store-deactivate-button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

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
    <PageContainer>
      <PageHeader
        title="Unidades"
        description="Gerencie as unidades da empresa (lojas, matriz, filiais)."
      />

      <StoreCreateForm />

      <Card>
        <CardHeader>
          <CardTitle>Unidades ativas ({active.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <EmptyState
              title="Nenhuma unidade cadastrada"
              description="Crie a primeira unidade para começar a operar."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {active.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
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
        </CardContent>
      </Card>
    </PageContainer>
  );
}