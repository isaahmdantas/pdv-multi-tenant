import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar | PDV Multi-tenant",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">PDV Multi-tenant</h1>
          <p className="text-sm text-muted-foreground">
            Entre com suas credenciais para acessar o painel.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}