import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Boxes,
  Calculator,
  ClipboardList,
  Package,
  ShoppingBasket,
  ShoppingCart,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreSwitchService } from "@/modules/iam/services/store-switch-service";
import { CashSessionService } from "@/modules/cash/services/cash-session-service";
import { StockService } from "@/modules/inventory/services/stock-service";
import { ProductService } from "@/modules/products/services/product-service";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SyncStatusIndicator } from "@/components/layout/sync-status";
import { formatBRL, formatRelativeDate, isToday } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Entrou no sistema",
  LOGOUT: "Saiu do sistema",
  STORE_SWITCHED: "Trocou de unidade",
  SALE_CREATED: "Registrou venda",
  CASH_OPENED: "Abriu sessão de caixa",
  CASH_SUPPLY: "Fez suprimento de caixa",
  CASH_WITHDRAWAL: "Fez sangria de caixa",
  CASH_CLOSED: "Fechou sessão de caixa",
  PRODUCT_CREATED: "Cadastrou produto",
  PRODUCT_UPDATED: "Atualizou produto",
  PRODUCT_DEACTIVATED: "Desativou produto",
  STOCK_ADJUSTED: "Ajustou estoque",
  CUSTOMER_CREATED: "Cadastrou cliente",
  SUPPLIER_CREATED: "Cadastrou fornecedor",
  PURCHASE_CREATED: "Criou compra",
  STORE_CREATED: "Criou unidade",
  STORE_UPDATED: "Atualizou unidade",
  PRICE_TABLE_CREATED: "Criou tabela de preço",
  PRICING_CHANGED: "Alterou preço/promoção",
};

function prettifyAction(action: string): string {
  return ACTION_LABELS[action] ?? action.toLowerCase().replace(/_/g, " ");
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const storeSwitch = new StoreSwitchService(prisma);
  const stores = await storeSwitch.listAccessibleStores(user.tenantId, user.id);
  const activeStore = stores.find((s) => s.storeId === user.storeId) ?? null;

  const ctx = {
    tenantId: user.tenantId,
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    permissions: user.permissions,
  };

  const cashService = new CashSessionService(prisma);
  const stockService = new StockService(prisma);

  const [sessions, alerts, products] = await Promise.all([
    cashService.list(ctx, { storeId: user.storeId ?? undefined }),
    stockService.alerts(ctx, user.storeId ?? undefined),
    new ProductService(prisma).list(ctx),
  ]);

  const openSessions = sessions.filter((s) => s.status === "OPEN");
  const closedToday = sessions.filter(
    (s) => s.status === "CLOSED" && isToday(s.closedAt),
  );

  const unitProducts = products.filter((p) => p.availableInStore);
  const productCount = user.storeId ? unitProducts.length : products.filter((p) => p.status === "ACTIVE").length;

  const canOpenCash = user.permissions.some((p) =>
    ["cash.open", "cash.close"].includes(p),
  );
  const canManageInventory = user.permissions.includes("inventory.adjust");

  const activity = await prisma.auditLog.findMany({
    where: user.storeId
      ? { tenantId: user.tenantId, storeId: user.storeId }
      : { tenantId: user.tenantId },
    orderBy: { timestamp: "desc" },
    take: 8,
    include: {
      user: { select: { name: true } },
      store: { select: { name: true, code: true } },
    },
  });

  const quickActions = [
    {
      href: "/caixa",
      label: "Caixa",
      icon: Calculator,
      perms: ["cash.open", "cash.close", "cash.withdraw", "cash.supply"],
    },
    { href: "/produtos", label: "Produtos", icon: Package, perms: ["products.create", "products.update", "products.delete"] },
    {
      href: "/clientes",
      label: "Clientes",
      icon: Users,
      perms: ["customers.manage"],
    },
    {
      href: "/compras",
      label: "Compras",
      icon: ShoppingBasket,
      perms: ["purchases.manage"],
    },
    {
      href: "/estoque",
      label: "Estoque",
      icon: Boxes,
      perms: ["inventory.adjust", "inventory.transfer"],
    },
    {
      href: "/unidades",
      label: "Unidades",
      icon: ClipboardList,
      perms: ["settings.manage"],
    },
  ].filter((action) => action.perms.some((p) => user.permissions.includes(p)));

  const firstName = user.name?.trim().split(/\s+/)[0] ?? user.email ?? "usuário";

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={undefined}
        actions={<SyncStatusIndicator />}
      />

      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold">Olá, {firstName} 👋</p>
            <p className="text-sm text-muted-foreground">
              {activeStore ? (
                <>
                  Unidade ativa: <span className="font-medium text-foreground">{activeStore.name}</span>
                  <span className="font-mono text-xs"> ({activeStore.code})</span>
                </>
              ) : user.storeId ? (
                "Carregando unidade ativa…"
              ) : (
                "Selecione uma unidade para começar."
              )}
            </p>
          </div>
          <Badge variant="outline" className="h-7 px-3">
            Hoje,{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            }).format(new Date())}
          </Badge>
        </div>
        {!user.storeId ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Use o seletor de unidade no topo da tela para escolher onde vai
            operar. Os indicadores abaixo refletirão a unidade escolhida.
          </p>
        ) : null}
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Caixas abertos</p>
            <p className="text-2xl font-semibold tabular-nums">{openSessions.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {openSessions.length > 0
                ? `em ${openSessions.length} ${openSessions.length === 1 ? "sessão" : "sessões"}`
                : "nenhuma sessão em aberto"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Fechamentos hoje</p>
            <p className="text-2xl font-semibold tabular-nums">{closedToday.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {closedToday.length > 0
                ? formatBRL(
                    closedToday.reduce((acc, s) => acc + Number(s.closingAmount ?? 0), 0),
                  )
                : "nenhum fechamento ainda"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Alertas de estoque</p>
            <p className="text-2xl font-semibold tabular-nums">{alerts.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {alerts.length > 0 ? "níveis abaixo do mínimo ou acima do máximo" : "tudo dentro do esperado"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              {user.storeId ? "Produtos na unidade" : "Produtos ativos"}
            </p>
            <p className="text-2xl font-semibold tabular-nums">{productCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.storeId ? "disponíveis para venda" : "no catálogo do tenant"}
            </p>
          </CardContent>
        </Card>
      </section>

      {canOpenCash && openSessions.length === 0 ? (
        <Alert>
          <AlertTitle>Nenhuma sessão de caixa aberta</AlertTitle>
          <AlertDescription className="max-w-none text-muted-foreground [&_p]:mb-0">
            Abra o caixa para iniciar operações nesta unidade.
          </AlertDescription>
          <AlertAction>
            <Link
              href="/caixa"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ir para o Caixa
            </Link>
          </AlertAction>
        </Alert>
      ) : null}

      {canManageInventory && alerts.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>{alerts.length} {alerts.length === 1 ? "produto" : "produtos"} precisam de atenção no estoque</AlertTitle>
          <AlertDescription className="max-w-none text-muted-foreground [&_p]:mb-0">
            Revise os níveis mínimo e máximo antes de novas compras.
          </AlertDescription>
          <AlertAction>
            <Link
              href="/estoque"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ver estoque
            </Link>
          </AlertAction>
        </Alert>
      ) : null}

      {quickActions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Atalhos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <action.icon />
                {action.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm text-muted-foreground">
            Atividade recente
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {user.storeId ? activeStore?.name ?? "esta unidade" : "todas as unidades"}
          </span>
        </CardHeader>
        <CardContent className="pt-0">
          {activity.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Nenhuma atividade registrada ainda"
              description="Operações nesta unidade aparecerão aqui."
            />
          ) : (
            <ul className="divide-y">
              {activity.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {prettifyAction(log.action)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {log.user?.name ?? "Sistema"}
                      {log.store ? ` · ${log.store.name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeDate(log.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="sr-only">
        Operando na unidade {activeStore ? `${activeStore.name} (${activeStore.code})` : "—"}
      </p>
    </PageContainer>
  );
}