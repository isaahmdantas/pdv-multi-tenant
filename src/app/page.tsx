export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          PDV Multi-tenant
        </h1>
        <p className="max-w-md text-muted-foreground">
          Sistema de ponto de venda multi-tenant, offline-first e fiscal-ready.
          Login e dashboard chegam nas próximas fases.
        </p>
      </div>
    </main>
  );
}