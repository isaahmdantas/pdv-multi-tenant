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

export const metadata: Metadata = {
  title: "Estoque | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

const levelClass: Record<string, string> = {
  LOW: "rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive",
  HIGH: "rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-700",
  OK: "rounded-full border bg-muted px-2 py-0.5 text-xs",
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
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground">
          Saldos por unidade, movimentações, transferências e inventário.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Produtos na unidade</p>
          <p className="text-xl font-semibold">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Alertas de nível</p>
          <p className="text-xl font-semibold">{alerts.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Inventários abertos</p>
          <p className="text-xl font-semibold">{openCount}</p>
        </div>
      </section>

      {canManage || canTransfer ? (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
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
        </section>
      ) : null}

      {alerts.length > 0 ? (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
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
                <span className={levelClass[a.level]}>{levelLabel[a.level]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Saldos ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum produto vinculado a esta unidade ainda.
          </p>
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
                  <span className={levelClass[r.level]}>{levelLabel[r.level]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
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
          <p className="text-sm text-muted-foreground">Nenhum inventário registrado.</p>
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
                        ? `· encerrado em ${new Date(inv.finishedAt).toLocaleDateString("pt-BR")}`
                        : ""}
                    </span>
                  </p>
                  <span
                    className={
                      inv.status === "OPEN"
                        ? "rounded-full border bg-muted px-2 py-0.5 text-xs"
                        : "rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {inv.status}
                  </span>
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
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Transferências ({transfers.length})
        </h2>
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma transferência registrada.</p>
        ) : (
          <ul className="space-y-3">
            {transfers.map((t) => (
              <li key={t.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {t.store.code} → {t.destinationStore.code}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString("pt-BR")}
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
      </section>
    </main>
  );
}