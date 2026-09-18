import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CustomerCategoryService } from "@/modules/customers/services/customer-category-service";
import { CustomerCategoryCreateForm } from "@/components/customers/customer-category-create-form";

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
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Categorias de cliente
        </h1>
        <p className="text-sm text-muted-foreground">
          Classificação de clientes do tenant.
        </p>
        <Link
          href="/clientes"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Voltar para clientes
        </Link>
      </header>

      {canCreate ? <CustomerCategoryCreateForm /> : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Categorias ({categories.length})
        </h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma categoria cadastrada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.isDefault ? "Categoria padrão" : "—"}
                  </p>
                </div>
                <span
                  className={
                    c.status === "ACTIVE"
                      ? "rounded-full border bg-muted px-2 py-0.5 text-xs"
                      : "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                  }
                >
                  {c.status === "ACTIVE" ? "Ativa" : "Inativa"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
