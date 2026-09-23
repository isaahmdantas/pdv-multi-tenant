import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SaleService } from "@/modules/sales/services/sale-service";
import type { SaleStatus } from "@/modules/sales/constants";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { SalesHistoryFilters } from "@/components/sales/sales-history-filters";
import { RefundSaleButton } from "@/components/sales/refund-sale-button";
import { CancelSaleButton } from "@/components/sales/cancel-sale-button";
import { formatBRL, formatDateTime } from "@/lib/format";
import { paymentLabel } from "@/components/pdv/types";

export const metadata: Metadata = {
  title: "Vendas | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

type SaleStatusQuery = SaleStatus | "";

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  if (!user.permissions.includes("reports.view")) redirect("/dashboard");

  const ctx = {
    tenantId: user.tenantId,
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    permissions: user.permissions,
  };

  const sp = await searchParams;
  const rawStatus = typeof sp.status === "string" ? sp.status : "";
  const status: SaleStatusQuery =
    rawStatus === "COMPLETED" ||
    rawStatus === "CANCELLED" ||
    rawStatus === "SUSPENDED"
      ? rawStatus
      : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

  const fromDate = from ? parseDate(from) : undefined;
  const toDate = to ? parseDate(to) : undefined;

  const sales = await new SaleService(prisma).list(ctx, {
    storeId: ctx.storeId ?? undefined,
    status: status || undefined,
    fromDate,
    toDate,
    limit: 100,
  });

  const paymentRows = await prisma.cashMovement.findMany({
    where: {
      tenantId: ctx.tenantId,
      type: "SALE",
      referenceType: "SALE",
      referenceId: { in: sales.map((s) => s.id) },
    },
    select: { referenceId: true, methodCode: true, amount: true },
  });
  const paymentsBySale = new Map<string, { label: string; amount: string }[]>();
  for (const row of paymentRows) {
    const list = paymentsBySale.get(row.referenceId!) ?? [];
    list.push({ label: paymentLabel(row.methodCode ?? "CASH"), amount: String(row.amount) });
    paymentsBySale.set(row.referenceId!, list);
  }

  const completed = sales.filter((s) => s.status === "COMPLETED");
  const completedTotal = completed.reduce(
    (sum, s) => sum + Number(s.total),
    0,
  );

  const canRefund = user.permissions.includes("sales.refund");
  const canCancel = user.permissions.includes("sales.cancel");

  return (
    <PageContainer>
      <PageHeader
        title="Vendas"
        description="Histórico de vendas do tenant, com pagamentos por forma e status."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesHistoryFilters status={status} from={from} to={to} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Vendas ({sales.length})
            {completed.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {completed.length} concluídas ·{" "}
                <span className="tabular-nums">{formatBRL(completedTotal)}</span> em
                vendas concluídas
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <EmptyState
              title="Nenhuma venda encontrada"
              description="Ajuste os filtros ou faça a primeira venda no PDV."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venda</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  {canRefund || canCancel ? (
                    <TableHead className="text-right">Ações</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const payments = paymentsBySale.get(sale.id) ?? [];
                  const visibleItems = sale.items.slice(0, 2);
                  const extraItems = sale.items.length - visibleItems.length;
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium tabular-nums">
                            #{sale.id.slice(-6)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(sale.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{sale.store.code}</span>{" "}
                        <span className="text-muted-foreground">{sale.store.name}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.operator?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.customer?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {visibleItems.map((item) => (
                            <span key={item.id} className="whitespace-normal">
                              <span className="tabular-nums">{Number(item.quantity)}×</span>{" "}
                              {item.product.name}
                            </span>
                          ))}
                          {extraItems > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              +{extraItems} itens
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {payments.length > 0 ? (
                            payments.map((p, i) => (
                              <span key={i} className="whitespace-nowrap">
                                <span className="text-muted-foreground">{p.label}:</span>{" "}
                                <span className="tabular-nums">{formatBRL(p.amount)}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold tabular-nums">
                            {formatBRL(sale.total)}
                          </span>
                          {Number(sale.discount) > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              desconto {formatBRL(sale.discount)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant={
                              sale.status === "COMPLETED"
                                ? "secondary"
                                : sale.status === "SUSPENDED"
                                  ? "outline"
                                  : "destructive"
                            }
                          >
                            {sale.status === "COMPLETED"
                              ? "Concluída"
                              : sale.status === "SUSPENDED"
                                ? "Suspensa"
                                : "Cancelada"}
                          </Badge>
                          {Number(sale.refundedTotal) > 0 ? (
                            <Badge variant="outline" className="text-rose-700">
                              {Number(sale.refundedTotal) >=
                              Number(sale.total) - 0.001
                                ? "Estornada"
                                : "Estorno parcial"}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      {canRefund || canCancel ? (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canRefund &&
                            sale.status === "COMPLETED" &&
                            Number(sale.refundedTotal) <
                              Number(sale.total) ? (
                              <RefundSaleButton
                                saleId={sale.id}
                                total={Number(sale.total)}
                                refundedTotal={Number(sale.refundedTotal)}
                                items={sale.items.map((it) => ({
                                  id: it.id,
                                  productName: it.product.name,
                                  quantity: Number(it.quantity),
                                  refundedQuantity: Number(it.refundedQuantity),
                                }))}
                              />
                            ) : null}
                            {canCancel && sale.status === "COMPLETED" ? (
                              <CancelSaleButton saleId={sale.id} />
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}