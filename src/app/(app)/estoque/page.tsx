import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StockService } from "@/modules/inventory/services/stock-service";
import { InventoryService } from "@/modules/inventory/services/inventory-service";
import { StoreService } from "@/modules/stores/services/store-service";
import { ProductService } from "@/modules/products/services/product-service";
import { UnitMeasureService } from "@/modules/products/services/unit-measure-service";
import { StockMovementForm } from "@/components/inventory/stock-movement-form";
import { StockAdjustForm } from "@/components/inventory/stock-adjust-form";
import { MinMaxForm } from "@/components/inventory/min-max-form";
import { TransferForm } from "@/components/inventory/transfer-form";
import { InventoryCloseForm } from "@/components/inventory/inventory-close-form";
import { InventoryOpenForm } from "@/components/inventory/inventory-open-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Estoque | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

const levelVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  LOW: "destructive",
  HIGH: "warning",
  OK: "secondary",
};

const levelLabel: Record<string, string> = {
  LOW: "Abaixo do mínimo",
  HIGH: "Acima do máximo",
  OK: "OK",
};

export default async function EstoquePage() {
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

  const stockService = new StockService(prisma);
  const [rows, alerts, transfers, inventories, stores, products, units] =
    await Promise.all([
      stockService.listAll(ctx, user.storeId ?? undefined, { includeZero: true }),
      stockService.alerts(ctx, user.storeId ?? undefined),
      stockService.listTransfers(ctx),
      new InventoryService(prisma).list(ctx, user.storeId ?? undefined, true),
      new StoreService(prisma).list(ctx),
      new ProductService(prisma).list(ctx),
      new UnitMeasureService(prisma).list(ctx),
    ]);

  const canManage = user.permissions.includes("inventory.adjust");
  const canTransfer = user.permissions.includes("inventory.transfer");

  const activeProducts = products.filter((p) => p.status === "ACTIVE");
  const productOptions = activeProducts.map((p) => ({
    id: p.id,
    label: `${p.sku} — ${p.name}`,
  }));
  const storeOptions = stores.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }));
  const unitOptions = units.filter((u) => u.status === "ACTIVE").map((u) => ({
    id: u.id,
    label: `${u.code} — ${u.name}`,
  }));

  const openInventory = inventories.find((i) => i.status === "OPEN");
  const openCount = inventories.filter((i) => i.status === "OPEN").length;

  return (
    <PageContainer>
      <PageHeader
        title="Estoque"
        description="Saldos por unidade, movimentações, transferências e inventário."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Produtos na unidade</p>
            <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Alertas de nível</p>
            <p className="text-2xl font-semibold tabular-nums">{alerts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Inventários abertos</p>
            <p className="text-2xl font-semibold tabular-nums">{openCount}</p>
          </CardContent>
        </Card>
      </section>

      {canManage || canTransfer ? (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              Movimentações
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {canManage ? (
                <>
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-3 text-sm font-medium">Entrada</h3>
                    <StockMovementForm type="IN" products={productOptions} units={unitOptions} />
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-3 text-sm font-medium">Saída</h3>
                    <StockMovementForm type="OUT" products={productOptions} units={unitOptions} />
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-3 text-sm font-medium">Ajuste</h3>
                    <StockAdjustForm products={productOptions} />
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-3 text-sm font-medium">Mínimo / máximo</h3>
                    <MinMaxForm products={productOptions} />
                  </div>
                </>
              ) : null}
              {canTransfer ? (
                <div className="rounded-lg border p-4 lg:col-span-2">
                  <h3 className="mb-3 text-sm font-medium">Transferência entre unidades</h3>
                  <TransferForm stores={storeOptions} products={productOptions} units={unitOptions} />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {alerts.length > 0 ? (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Alertas de estoque ({alerts.length})
            </h2>
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.productId}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {a.name}
                    <span className="font-mono text-xs text-muted-foreground"> ({a.sku})</span>
                  </span>
                  <Badge variant={levelVariant[a.level]}>{levelLabel[a.level]}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Saldos ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <EmptyState
              title="Nenhum produto vinculado a esta unidade"
              description="Vincule produtos à unidade atual para acompanhar os saldos."
            />
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.productId}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      {r.name}
                      <span className="font-mono text-xs text-muted-foreground"> ({r.sku})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      mín {r.minStock.toString()} · máx {r.maxStock.toString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-right">
                      <span className="font-mono text-base font-medium">
                        {r.availableQuantity.toString()}
                      </span>
                      <span className="block text-[10px] uppercase text-muted-foreground">
                        disponível
                      </span>
                    </span>
                    <Badge variant={levelVariant[r.level]}>{levelLabel[r.level]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Inventário ({inventories.length})
          </h2>
          {canManage && !openInventory ? (
            <div className="mb-3 rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-medium">Novo inventário</h3>
              <InventoryOpenForm />
            </div>
          ) : null}
          {inventories.length === 0 ? (
            <EmptyState title="Nenhum inventário registrado" />
          ) : (
            <ul className="space-y-3">
              {inventories.map((inv) => (
                <li key={inv.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm">
                      {inv.status === "OPEN" ? "Inventário aberto" : "Inventário encerrado"}
                      <span className="text-muted-foreground">
                        {" "}
                        · {inv.items.length} itens{" "}
                        {inv.finishedAt
                          ? `· encerrado em ${formatDateTime(inv.finishedAt)}`
                          : ""}
                      </span>
                    </p>
                    <Badge variant={inv.status === "OPEN" ? "success" : "secondary"}>
                      {inv.status}
                    </Badge>
                  </div>
                  {inv.status === "OPEN" && canManage ? (
                    <div className="mt-3">
                      <InventoryCloseForm
                        inventoryId={inv.id}
                        items={inv.items.map((item) => ({
                          productId: item.productId,
                          productName: item.product.name,
                          sku: item.product.sku,
                          expected: item.expectedQuantity.toString(),
                        }))}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Transferências ({transfers.length})
          </h2>
          {transfers.length === 0 ? (
            <EmptyState title="Nenhuma transferência registrada" />
          ) : (
            <ul className="space-y-3">
              {transfers.map((t) => (
                <li key={t.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {t.store.code} → {t.destinationStore.code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {t.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <span>
                          {item.product.name}
                          <span className="font-mono"> ({item.product.sku})</span>
                        </span>
                        <span className="font-mono">
                          {item.quantity.toString()}
                          {item.unitOfMeasure ? ` ${item.unitOfMeasure.code}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}