import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PriceTableService } from "@/modules/pricing/services/price-table-service";
import { ProductPriceService } from "@/modules/pricing/services/product-price-service";
import { PromotionService } from "@/modules/pricing/services/promotion-service";
import { StoreService } from "@/modules/stores/services/store-service";
import { CustomerCategoryService } from "@/modules/customers/services/customer-category-service";
import { ProductService } from "@/modules/products/services/product-service";
import { PriceTableCreateForm } from "@/components/pricing/price-table-create-form";
import { ProductPriceCreateForm } from "@/components/pricing/product-price-create-form";
import { PromotionCreateForm } from "@/components/pricing/promotion-create-form";

export const metadata: Metadata = {
  title: "Preços | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function PrecosPage() {
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

  const [tables, promotions, stores, categories, products] = await Promise.all([
    new PriceTableService(prisma).list(ctx, { includeInactive: true }),
    new PromotionService(prisma).list(ctx, { includeInactive: true }),
    new StoreService(prisma).list(ctx),
    new CustomerCategoryService(prisma).list(ctx),
    new ProductService(prisma).list(ctx),
  ]);

  const priceService = new ProductPriceService(prisma);
  const rowsByTable = new Map<string, Awaited<ReturnType<typeof priceService.listByTable>>>();
  for (const table of tables) {
    rowsByTable.set(table.id, await priceService.listByTable(ctx, table.id));
  }

  const activeTables = tables.filter((t) => t.active).length;
  const canCreate = user.permissions.includes("pricing.manage");

  const storeOptions = stores.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }));
  const categoryOptions = categories.map((c) => ({ id: c.id, label: c.name }));
  const productOptions = products
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({ id: p.id, label: `${p.sku} — ${p.name}` }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Preços</h1>
        <p className="text-sm text-muted-foreground">
          Tabelas de preço, preços por produto e promoções do tenant.
        </p>
      </header>

      {canCreate ? (
        <>
          <PriceTableCreateForm
            stores={storeOptions}
            categories={categoryOptions}
          />
          <PromotionCreateForm
            stores={storeOptions}
            products={productOptions}
            categories={categoryOptions}
          />
        </>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Tabelas de preço ({tables.length} · {activeTables} ativa
          {activeTables === 1 ? "" : "s"})
        </h2>
        {tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tabela de preço cadastrada ainda.
          </p>
        ) : (
          <ul className="space-y-4">
            {tables.map((t) => {
              const rows = rowsByTable.get(t.id) ?? [];
              return (
                <li key={t.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.store ? `Unidade ${t.store.name}` : "Todas as unidades"}
                        {t.customerCategory
                          ? ` · ${t.customerCategory.name}`
                          : ""}
                        {t.description ? ` · ${t.description}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <span className="font-mono text-sm">
                        R$ {t.defaultPrice.toString()}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full border bg-muted px-2 py-0.5 text-xs">
                          pri {t.priority}
                        </span>
                        <span
                          className={
                            t.active
                              ? "rounded-full border bg-muted px-2 py-0.5 text-xs"
                              : "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                          }
                        >
                          {t.active ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {rows.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {rows.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            {r.product.name}
                            <span className="font-mono text-xs text-muted-foreground">
                              {" "}
                              ({r.product.sku})
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3 font-mono text-xs text-muted-foreground">
                            {r.minimumQuantity !== null ? `≥ ${r.minimumQuantity.toString()}` : "qualquer qtd"}
                            {r.minimumQuantity !== null && r.maximumQuantity !== null ? ` · ≤ ${r.maximumQuantity.toString()}` : ""}
                            <span className="text-sm text-foreground">
                              R$ {r.unitPrice.toString()}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canCreate ? (
                    <ProductPriceCreateForm
                      priceTableId={t.id}
                      products={productOptions}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Promoções ({promotions.length})
        </h2>
        {promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma promoção cadastrada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {promotions.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.discountType === "PERCENTAGE"
                      ? `${p.discountValue.toString()}% de desconto`
                      : `R$ ${p.discountValue.toString()} de desconto`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.product ? `${p.product.name} · ` : "Todos os produtos · "}
                    {p.store ? `Unidade ${p.store.name} · ` : "Todas as unidades · "}
                    {p.customerCategory ? p.customerCategory.name : "Todas as categorias"}
                  </p>
                </div>
                <span
                  className={
                    p.active
                      ? "rounded-full border bg-muted px-2 py-0.5 text-xs"
                      : "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                  }
                >
                  {p.active ? "Ativa" : "Inativa"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}