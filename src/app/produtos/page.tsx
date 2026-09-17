import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductService } from "@/modules/products/services/product-service";
import { ProductCategoryService } from "@/modules/products/services/product-category-service";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { ProductCreateForm } from "@/components/products/product-create-form";

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
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de produtos do tenant.
        </p>
      </header>

      {canCreate ? (
        <ProductCreateForm
          categories={categories.map((c) => ({ id: c.id, label: c.name }))}
          units={units.map((u) => ({ id: u.id, label: `${u.code} — ${u.name}` }))}
        />
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Produtos ({products.length})
        </h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum produto cadastrado ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm">
                    R$ {p.basePrice.toString()}
                  </span>
                  <span
                    className={
                      p.availableInStore
                        ? "rounded-full border bg-muted px-2 py-0.5 text-xs"
                        : "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                    }
                  >
                    {p.availableInStore
                      ? "Disponível nesta unidade"
                      : "Indisponível nesta unidade"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}