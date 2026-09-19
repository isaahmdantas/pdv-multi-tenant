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

export const metadata: Metadata = {
  title: "Compras | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

const statusClass: Record<string, string> = {
  ORDERED: "rounded-full border bg-muted px-2 py-0.5 text-xs",
  RECEIVED: "rounded-full border border-emerald-500/40 px-2 py-0.5 text-xs text-emerald-700",
  CANCELLED: "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive",
};

const statusLabel: Record<string, string> = {
  ORDERED: "Em andamento",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
};

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

  const orderedCount = purchases.filter((p) => p.status === "ORDERED").length;
  const receivedCount = purchases.filter((p) => p.status === "RECEIVED").length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
        <p className="text-sm text-muted-foreground">
          Fornecedores, pedidos de compra, custos, lotes e entradas no estoque.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Fornecedores ativos</p>
          <p className="text-xl font-semibold">{suppliers.filter((s) => s.status === "ACTIVE").length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Pedidos em andamento</p>
          <p className="text-xl font-semibold">{orderedCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Pedidos recebidos</p>
          <p className="text-xl font-semibold">{receivedCount}</p>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Novo pedido de compra
          </h2>
          <PurchaseCreateForm
            stores={storeOptions}
            suppliers={supplierOptions}
            products={productOptions}
            units={unitOptions}
          />
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Pedidos ({purchases.length})
        </h2>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido de compra registrado.
          </p>
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
                      {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={statusClass[p.status]}>{statusLabel[p.status]}</span>
                    <span className="font-mono text-sm font-medium">
                      R$ {p.totalAmount.toString()}
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
                              ? ` · validade ${new Date(item.expiryDate).toLocaleDateString("pt-BR")}`
                              : ""}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono">
                        {item.quantity.toString()}
                        {item.unitOfMeasure ? ` ${item.unitOfMeasure.code}` : ""} ×{" "}
                        {item.unitCost.toString()} = {item.totalCost.toString()}
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
      </section>

      {canManage ? (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Novo fornecedor
          </h2>
          <SupplierCreateForm />
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Fornecedores ({suppliers.length})
        </h2>
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
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
                <span
                  className={
                    s.status === "ACTIVE"
                      ? "rounded-full border bg-muted px-2 py-0.5 text-xs"
                      : "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                  }
                >
                  {s.status === "ACTIVE" ? "Ativo" : "Inativo"}
                </span>
                {canManage && s.status === "ACTIVE" ? (
                  <SupplierDeactivateButton supplierId={s.id} name={s.name} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}