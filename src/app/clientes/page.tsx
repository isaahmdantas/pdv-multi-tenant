import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CustomerService } from "@/modules/customers/services/customer-service";
import { CustomerCategoryService } from "@/modules/customers/services/customer-category-service";
import { CustomerCreateForm } from "@/components/customers/customer-create-form";

export const metadata: Metadata = {
  title: "Clientes | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
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

  const [customers, categories] = await Promise.all([
    new CustomerService(prisma).list(ctx),
    new CustomerCategoryService(prisma).list(ctx),
  ]);

  const canCreate = user.permissions.includes("customers.manage");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de clientes do tenant.
        </p>
        <Link
          href="/clientes/categorias"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Gerenciar categorias de cliente
        </Link>
      </header>

      {canCreate ? (
        <CustomerCreateForm
          categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        />
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Clientes ({customers.length})
        </h2>
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cliente cadastrado ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {customers.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {c.document ?? "—"}
                    {c.email ? ` · ${c.email}` : ""}
                    {c.category ? ` · ${c.category.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm">
                    R$ {c.creditLimit.toString()}
                  </span>
                  <span
                    className={
                      c.status === "ACTIVE"
                        ? "rounded-full border bg-muted px-2 py-0.5 text-xs"
                        : "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                    }
                  >
                    {c.status === "ACTIVE" ? "Ativo" : "Inativo"}
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
