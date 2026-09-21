import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductService } from "@/modules/products/services/product-service";
import { ProductCategoryService } from "@/modules/products/services/product-category-service";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { ProductCreateForm } from "@/components/products/product-create-form";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Produtos | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
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

  const [products, categories, units] = await Promise.all([
    new ProductService(prisma).list(ctx),
    new ProductCategoryService(prisma).list(ctx),
    new UnitMeasureService(prisma).list(ctx),
  ]);

  const canCreate = user.permissions.includes("products.create");

  return (
    <PageContainer>
      <PageHeader
        title="Produtos"
        description="Catálogo de produtos do tenant."
      />

      {canCreate ? (
        <ProductCreateForm
          categories={categories.map((c) => ({ id: c.id, label: c.name }))}
          units={units.map((u) => ({ id: u.id, label: `${u.code} — ${u.name}` }))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Produtos ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <EmptyState
              title="Nenhum produto cadastrado"
              description="Cadastre o primeiro produto para começar a operar."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {p.sku}
                      {p.category ? ` · ${p.category.name}` : ""}
                      {p.brand ? ` · ${p.brand.name}` : ""} ·{" "}
                      {p.baseUnit ? p.baseUnit.code : "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatBRL(p.basePrice)}
                    </span>
                    <Badge
                      variant={p.availableInStore ? "secondary" : "destructive"}
                    >
                      {p.availableInStore
                        ? "Disponível nesta unidade"
                        : "Indisponível nesta unidade"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}