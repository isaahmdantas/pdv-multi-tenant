import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CustomerCategoryService } from "@/modules/customers/services/customer-category-service";
import { CustomerCategoryCreateForm } from "@/components/customers/customer-category-create-form";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Categorias de cliente | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function ClientesCategoriasPage() {
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

  const categories = await new CustomerCategoryService(prisma).list(ctx);

  const canCreate = user.permissions.includes("customers.manage");

  return (
    <PageContainer>
      <PageHeader
        title="Categorias de cliente"
        description="Classificação de clientes do tenant."
        actions={
          <Link
            href="/clientes"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Voltar para clientes
          </Link>
        }
      />

      {canCreate ? <CustomerCategoryCreateForm /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Categorias ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              title="Nenhuma categoria cadastrada"
              description="As categorias ajudam a classificar seus clientes."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.isDefault
                        ? "Categoria padrão — aplicada a novos clientes"
                        : "—"}
                    </p>
                  </div>
                  <Badge variant={c.status === "ACTIVE" ? "secondary" : "destructive"}>
                    {c.status === "ACTIVE" ? "Ativa" : "Inativa"}
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
