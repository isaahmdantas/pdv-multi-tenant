import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { StoreService } from '@/modules/stores/services/store-service';
import { CustomerService } from '@/modules/customers/services/customer-service';
import { CashSessionService } from '@/modules/cash/services/cash-session-service';
import { PdvShell } from '@/components/pdv/pdv-shell';
import type { PdvCustomer, PdvProduct } from '@/components/pdv/types';

export const metadata: Metadata = {
  title: 'PDV | PDV Multi-tenant',
};

export const dynamic = 'force-dynamic';

export default async function PdvPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user;

  if (!user.permissions.includes('sales.create')) redirect('/dashboard');

  const ctx = {
    tenantId: user.tenantId,
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    permissions: user.permissions,
  };

  const stores = await new StoreService(prisma).list(ctx);
  const currentStore = stores.find((s) => s.id === user.storeId && s.status === 'ACTIVE') ?? null;

  if (!currentStore) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Selecione uma unidade ativa</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Escolha uma unidade no seletor do painel administrativo antes de usar o PDV.
        </p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Ir para o painel
        </Link>
      </div>
    );
  }

  const [customers, sessions, productRows] = await Promise.all([
    new CustomerService(prisma).list(ctx),
    new CashSessionService(prisma).list(ctx, { storeId: currentStore.id }),
    prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'ACTIVE',
        storeLinks: { some: { storeId: currentStore.id, status: 'ACTIVE' } },
      },
      select: { id: true, name: true, sku: true, barcodes: { select: { value: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const products: PdvProduct[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcodes: p.barcodes.map((b) => b.value),
  }));

  const pdvCustomers: PdvCustomer[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    document: c.document,
    categoryName: c.category?.name ?? null,
  }));

  const openSession =
    sessions.find((s) => s.status === 'OPEN') ?? null;

  return (
    <PdvShell
      store={{ id: currentStore.id, name: currentStore.name, code: currentStore.code }}
      operatorName={user.name ?? 'Operador'}
      openSession={openSession ? { id: openSession.id, cashRegisterName: openSession.cashRegister?.name ?? '' } : null}
      products={products}
      customers={pdvCustomers}
    />
  );
}