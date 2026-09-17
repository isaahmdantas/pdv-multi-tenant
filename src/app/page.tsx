import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          PDV Multi-tenant
        </h1>
        <p className="max-w-md text-muted-foreground">
          Sistema de ponto de venda multi-tenant, offline-first e fiscal-ready.
        </p>
        <div className="flex gap-3">
          <Link href="/login" className={buttonVariants({ variant: "default" })}>
            Entrar
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}