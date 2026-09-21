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

export const metadata: Metadata = {
  title: 'Caixa | PDV Multi-tenant',
};

export const dynamic = 'force-dynamic';

const statusClass: Record<string, string> = {
  OPEN: 'rounded-full border border-emerald-500/40 px-2 py-0.5 text-xs text-emerald-700 bg-emerald-50',
  CLOSED: 'rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive bg-destructive/10',
};

const statusLabel: Record<string, string> = {
  OPEN: 'Aberto',
  CLOSED: 'Fechado',
};

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caixa</h1>
          <p className="text-muted-foreground">Gerencie aberturas, suprimentos, sangrias e fechamentos</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 bg-card">
          <p className="text-sm text-muted-foreground">Caixas Abertos</p>
          <p className="text-3xl font-bold">{openSessions.length}</p>
        </div>
        <div className="rounded-lg border p-4 bg-card">
          <p className="text-sm text-muted-foreground">Fechados Hoje</p>
          <p className="text-3xl font-bold">{closedSessions.filter(s => s.closedAt && new Date(s.closedAt).toDateString() === new Date().toDateString()).length}</p>
        </div>
        <div className="rounded-lg border p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total de Caixas</p>
          <p className="text-3xl font-bold">{cashRegisters.length}</p>
        </div>
      </div>

      {canManage && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Abrir Nova Sessão</h2>
          <OpenCashSessionForm cashRegisters={cashRegisterOptions} />
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Sessões de Caixa</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Caixa</th>
                <th className="pb-2 pr-4">Unidade</th>
                <th className="pb-2 pr-4">Abertura</th>
                <th className="pb-2 pr-4">Fechamento</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Valor Inicial</th>
                <th className="pb-2 pr-4">Valor Final</th>
                <th className="pb-2 pr-4">Diferença</th>
                <th className="pb-2 pr-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {[...openSessions, ...closedSessions].map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">{s.cashRegister?.name}</td>
                  <td className="py-3 pr-4">{s.store?.code} — {s.store?.name}</td>
                  <td className="py-3 pr-4">{new Date(s.openedAt).toLocaleString('pt-BR')}</td>
                  <td className="py-3 pr-4">{s.closedAt ? new Date(s.closedAt).toLocaleString('pt-BR') : '-'}</td>
                  <td className="py-3 pr-4">
                    <span className={statusClass[s.status] || ''}>{statusLabel[s.status] || s.status}</span>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">R$ {Number(s.openingAmount).toFixed(2)}</td>
                  <td className="py-3 pr-4 tabular-nums">{s.closingAmount ? `R$ ${Number(s.closingAmount).toFixed(2)}` : '-'}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {s.difference !== null && s.difference !== undefined ? (
                      <span className={s.classification === 'SURPLUS' ? 'text-emerald-600' : s.classification === 'SHORTAGE' ? 'text-destructive' : ''}>
                        R$ {Number(s.difference).toFixed(2)} {s.classification}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
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
              {!sessions.length && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    Nenhuma sessão de caixa encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openSessions.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold mb-4">Movimentações das Sessões Abertas</h2>
          {openSessions.map((s) => (
            <div key={s.id} className="mb-6">
              <h3 className="font-medium mb-2">Caixa: {s.cashRegister?.name} — {s.store?.name}</h3>
              <MovementsList
                movements={(s.movements || []).map((m) => ({
                  ...m,
                  amount: Number(m.amount),
                  createdAt: m.createdAt.toISOString(),
                }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}