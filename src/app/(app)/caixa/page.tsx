import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CashRegisterService } from '@/modules/stores/services/cash-register-service';
import { CashSessionService } from '@/modules/cash/services/cash-session-service';
import { OpenCashSessionForm } from '@/components/cash/open-cash-session-form';
import { CashActionButton } from '@/components/cash/cash-action-button';
import { CloseCashSessionForm } from '@/components/cash/close-cash-session-form';
import { MovementsList } from '@/components/cash/movements-list';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatBRL, formatDateTime } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Caixa | PDV Multi-tenant',
};

export const dynamic = 'force-dynamic';

const statusVariant: Record<string, 'success' | 'destructive' | 'secondary'> = {
  OPEN: 'success',
  CLOSED: 'secondary',
};

const statusLabel: Record<string, string> = {
  OPEN: 'Aberto',
  CLOSED: 'Fechado',
};

const diffVariant: Record<string, 'success' | 'destructive' | 'outline'> = {
  SURPLUS: 'success',
  SHORTAGE: 'destructive',
  EXACT: 'outline',
};

const diffLabel: Record<string, string> = {
  SURPLUS: 'Sobra',
  SHORTAGE: 'Falta',
  EXACT: 'Exato',
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

export default async function CaixaPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user;

  const ctx = {
    tenantId: user.tenantId,
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    permissions: user.permissions,
  };

  const cashRegisterService = new CashRegisterService(prisma);
  const cashSessionService = new CashSessionService(prisma);

  const canOpen = user.permissions.includes('cash.open');
  const canClose = user.permissions.includes('cash.close');
  const canSupply = user.permissions.includes('cash.supply');
  const canWithdraw = user.permissions.includes('cash.withdraw');
  const canManage = canOpen || canClose || canSupply || canWithdraw;

  const [cashRegisters, sessions] = await Promise.all([
    cashRegisterService.list(ctx, user.storeId ?? undefined),
    cashSessionService.list(ctx, { storeId: user.storeId ?? undefined }),
  ]);

  const cashRegisterOptions = cashRegisters.map((r) => ({ id: r.id, label: `${r.store?.code} — ${r.name}` }));

  const openSessions = sessions.filter((s) => s.status === 'OPEN');
  const closedSessions = sessions.filter((s) => s.status === 'CLOSED');
  const closedToday = closedSessions.filter(
    (s) => s.closedAt && new Date(s.closedAt).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <PageContainer>
      <PageHeader
        title="Caixa"
        description="Gerencie aberturas, suprimentos, sangrias e fechamentos da unidade."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Caixas abertos" value={openSessions.length} />
        <KpiCard label="Fechados hoje" value={closedToday} />
        <KpiCard label="Total de caixas" value={cashRegisters.length} />
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Abrir nova sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <OpenCashSessionForm cashRegisters={cashRegisterOptions} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sessões de caixa</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nenhuma sessão de caixa"
                description="Abra uma sessão para registrar movimentações."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-3 pr-4 pl-4 font-medium">Caixa</th>
                    <th className="py-3 pr-4 font-medium">Unidade</th>
                    <th className="py-3 pr-4 font-medium">Abertura</th>
                    <th className="py-3 pr-4 font-medium">Fechamento</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium text-right">Valor inicial</th>
                    <th className="py-3 pr-4 font-medium text-right">Valor final</th>
                    <th className="py-3 pr-4 font-medium text-right">Diferença</th>
                    <th className="py-3 pr-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {[...openSessions, ...closedSessions].map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 pr-4 pl-4 font-medium">{s.cashRegister?.name}</td>
                      <td className="py-3 pr-4">{s.store?.code} — {s.store?.name}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{formatDateTime(s.openedAt)}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{s.closedAt ? formatDateTime(s.closedAt) : '-'}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant[s.status] ?? 'secondary'}>
                          {statusLabel[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                        {formatBRL(s.openingAmount)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {s.closingAmount != null ? formatBRL(s.closingAmount) : '-'}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {s.difference != null ? (
                          <span
                            className={`${
                              s.classification === 'SURPLUS'
                                ? 'text-success'
                                : s.classification === 'SHORTAGE'
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {formatBRL(s.difference)}{' '}
                            <Badge variant={diffVariant[s.classification ?? ''] ?? 'outline'}>
                              {diffLabel[s.classification ?? ''] ?? s.classification ?? '—'}
                            </Badge>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          {s.status === 'OPEN' && canSupply && (
                            <CashActionButton
                              sessionId={s.id}
                              action="supply"
                              label="Suprir"
                              methodCodes={['CASH', 'PIX', 'CREDIT', 'DEBIT', 'VOUCHER']}
                            />
                          )}
                          {s.status === 'OPEN' && canWithdraw && (
                            <CashActionButton
                              sessionId={s.id}
                              action="withdraw"
                              label="Sangrar"
                              methodCodes={['CASH', 'PIX', 'CREDIT', 'DEBIT', 'VOUCHER']}
                            />
                          )}
                          {s.status === 'OPEN' && canClose && (
                            <CloseCashSessionForm
                              sessionId={s.id}
                              expectedByMethod={{
                                CASH: '0',
                                PIX: '0',
                                CREDIT: '0',
                                DEBIT: '0',
                                VOUCHER: '0',
                              }}
                              onClose={() => {}}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {openSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Movimentações das sessões abertas</CardTitle>
          </CardHeader>
          <CardContent>
            {openSessions.map((s) => (
              <div key={s.id} className="mb-6 last:mb-0">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Caixa: {s.cashRegister?.name} — {s.store?.name}
                </h3>
                <div className="mt-2">
                  <MovementsList
                    movements={(s.movements || []).map((m) => ({
                      ...m,
                      amount: Number(m.amount),
                      createdAt: m.createdAt.toISOString(),
                    }))}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}