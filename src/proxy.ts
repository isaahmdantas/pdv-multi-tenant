// Next.js 16: "middleware" virou "proxy" e roda em runtime Node.js.
// Protege as rotas do App Router (autorização via callback authorized) e
// redireciona não autenticados para /login. Rotas /api/* são públicas aqui
// (protegidas individualmente por withApiGuards).
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};