import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CustomerService } from "@/modules/customers/services/customer-service";
import { CustomerCategoryService } from "@/modules/customers/services/customer-category-service";
import { CustomerCreateForm } from "@/components/customers/customer-create-form";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL } from "@/lib/format";

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
    <PageContainer>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes do tenant."
        actions={
          <Link
            href="/clientes/categorias"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Gerenciar categorias de cliente
          </Link>
        }
      />

      {canCreate ? (
        <CustomerCreateForm
          categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Clientes ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <EmptyState
              title="Nenhum cliente cadastrado"
              description="Cadastre o primeiro cliente para usá-lo nas vendas."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {customers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.document ?? "—"}
                      {c.email ? ` · ${c.email}` : ""}
                      {c.category ? ` · ${c.category.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatBRL(c.creditLimit)}
                    </span>
                    <Badge variant={c.status === "ACTIVE" ? "secondary" : "destructive"}>
                      {c.status === "ACTIVE" ? "Ativo" : "Inativo"}
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