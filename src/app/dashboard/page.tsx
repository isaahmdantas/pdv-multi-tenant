import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreSwitchService } from "@/modules/iam/services/store-switch-service";
import { StoreSwitcher } from "@/components/auth/store-switcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard | PDV Multi-tenant",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const stores = await new StoreSwitchService(prisma).listAccessibleStores(
    user.tenantId,
    user.id,
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Bem-vindo(a), {user.name}.
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Sessão atual
        </h2>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tenant</dt>
            <dd className="font-mono text-xs">{user.tenantId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Unidade ativa</dt>
            <dd className="font-medium">{user.storeId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Role efetiva</dt>
            <dd className="font-medium">{user.role}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <p className="text-muted-foreground">Permissões</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {user.permissions.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhuma</span>
            ) : (
              user.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-full border bg-muted px-2 py-0.5 font-mono text-xs"
                >
                  {p}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <StoreSwitcher stores={stores} currentStoreId={user.storeId} />
      </section>

      <nav className="flex gap-3">
        <Link
          href="/unidades"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Unidades
        </Link>
      </nav>
    </main>
  );
}