import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreService } from "@/modules/stores/services/store-service";
import { ProductService } from "@/modules/products/services/product-service";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { SupplierService } from "@/modules/purchases/services/supplier-service";
import { PurchaseService } from "@/modules/purchases/services/purchase-service";
import { SupplierCreateForm } from "@/components/purchases/supplier-create-form";
import { SupplierDeactivateButton } from "@/components/purchases/supplier-deactivate-button";
import { PurchaseCreateForm } from "@/components/purchases/purchase-create-form";
import { PurchaseActions } from "@/components/purchases/purchase-actions";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Compras | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

const statusClass: Record<string, "secondary" | "success" | "destructive"> = {
  ORDERED: "secondary",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

const statusLabel: Record<string, string> = {
  ORDERED: "Em andamento",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
};

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function ComprasPage() {
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

  const supplierService = new SupplierService(prisma);
  const [suppliers, purchases, stores, products, units] = await Promise.all([
    supplierService.list(ctx),
    new PurchaseService(prisma).list(ctx, { storeId: user.storeId ?? undefined }),
    new StoreService(prisma).list(ctx),
    new ProductService(prisma).list(ctx),
    new UnitMeasureService(prisma).list(ctx),
  ]);

  const canManage = user.permissions.includes("purchases.manage");
  const activeProducts = products.filter((p) => p.status === "ACTIVE");
  const productOptions = activeProducts.map((p) => ({
    id: p.id,
    label: `${p.sku} — ${p.name}`,
  }));
  const storeOptions = stores.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }));
  const supplierOptions = suppliers
    .filter((s) => s.status === "ACTIVE")
    .map((s) => ({ id: s.id, label: s.name }));
  const unitOptions = units.filter((u) => u.status === "ACTIVE").map((u) => ({
    id: u.id,
    label: `${u.code} — ${u.name}`,
  }));

  const supplierCount = suppliers.filter((s) => s.status === "ACTIVE").length;
  const orderedCount = purchases.filter((p) => p.status === "ORDERED").length;
  const receivedCount = purchases.filter((p) => p.status === "RECEIVED").length;

  return (
    <PageContainer>
      <PageHeader
        title="Compras"
        description="Fornecedores, pedidos de compra, custos, lotes e entradas no estoque."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Fornecedores ativos" value={supplierCount} />
        <KpiCard label="Pedidos em andamento" value={orderedCount} />
        <KpiCard label="Pedidos recebidos" value={receivedCount} />
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Novo pedido de compra</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseCreateForm
              stores={storeOptions}
              suppliers={supplierOptions}
              products={productOptions}
              units={unitOptions}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pedidos ({purchases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <EmptyState
              title="Nenhum pedido de compra registrado"
              description="Os pedidos aparecerão aqui após a primeira compra."
            />
          ) : (
            <ul className="space-y-3">
              {purchases.map((p) => (
                <li key={p.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {p.supplier ? p.supplier.name : "Sem fornecedor"}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {p.store.name}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.createdAt)}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusClass[p.status]}>{statusLabel[p.status]}</Badge>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatBRL(p.totalAmount)}
                      </span>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {p.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <span className="min-w-0 truncate">
                          {item.product.name}
                          <span className="font-mono"> ({item.product.sku})</span>
                          {item.batchNumber || item.expiryDate ? (
                            <span className="ml-1">
                              {item.batchNumber ? `· lote ${item.batchNumber}` : ""}
                              {item.expiryDate
                                ? ` · validade ${formatDate(item.expiryDate)}`
                                : ""}
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono tabular-nums">
                          {item.quantity.toString()}
                          {item.unitOfMeasure ? ` ${item.unitOfMeasure.code}` : ""} ×{" "}
                          {formatBRL(item.unitCost)} = {formatBRL(item.totalCost)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {p.status === "ORDERED" && canManage ? (
                    <div className="mt-3">
                      <PurchaseActions purchaseId={p.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Novo fornecedor</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierCreateForm />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fornecedores ({suppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <EmptyState
              title="Nenhum fornecedor cadastrado"
              description="Cadastre fornecedores para registrar compras."
            />
          ) : (
            <ul className="space-y-2">
              {suppliers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      {s.name}
                      {s.document ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {" "}
                          ({s.document})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[s.city, s.state].filter(Boolean).join(" / ") || "—"}
                      {s.email ? ` · ${s.email}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={s.status === "ACTIVE" ? "secondary" : "destructive"}>
                      {s.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </Badge>
                    {canManage && s.status === "ACTIVE" ? (
                      <SupplierDeactivateButton supplierId={s.id} name={s.name} />
                    ) : null}
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