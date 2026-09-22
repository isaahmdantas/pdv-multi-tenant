import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { UnitMeasureCreateForm } from "@/components/products/unit-measure-create-form";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Unidades de medida | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function ProdutosUnidadesMedidaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const ctx = {
    tenantId: user.tenantId,
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    permissions: user.permissions,
  };

  const units = await new UnitMeasureService(prisma).list(ctx);

  const canCreate = user.permissions.includes("products.create");

  return (
    <PageContainer>
      <PageHeader
        title="Unidades de medida"
        description="Unidades de medida para produtos (UN, KG, CX, etc.)."
        actions={
          <Link
            href="/produtos"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Voltar para produtos
          </Link>
        }
      />

      {canCreate ? <UnitMeasureCreateForm /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Unidades de medida ({units.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <EmptyState
              title="Nenhuma unidade de medida cadastrada"
              description="Cadastre as unidades necessárias para seus produtos."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {units.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{u.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {u.code} · {u.conversions.length} conversão(ões)
                    </p>
                  </div>
                  <Badge variant={u.status === "ACTIVE" ? "secondary" : "destructive"}>
                    {u.status === "ACTIVE" ? "Ativa" : "Inativa"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}