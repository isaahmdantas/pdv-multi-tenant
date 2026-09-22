import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductCategoryService } from "@/modules/products/services/product-category-service";
import { ProductCategoryCreateForm } from "@/components/products/product-category-create-form";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Categorias de produto | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function ProdutosCategoriasPage() {
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

  const categories = await new ProductCategoryService(prisma).list(ctx);

  const canCreate = user.permissions.includes("products.create");

  return (
    <PageContainer>
      <PageHeader
        title="Categorias de produto"
        description="Classificação de produtos do tenant."
        actions={
          <Link
            href="/produtos"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Voltar para produtos
          </Link>
        }
      />

      {canCreate ? <ProductCategoryCreateForm /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Categorias ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              title="Nenhuma categoria cadastrada"
              description="As categorias ajudam a organizar seus produtos."
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
                      {c.status === "ACTIVE" ? "Ativa" : "Inativa"}
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
