import "@testing-library/jest-dom/vitest";

// Ambientes de teste não carregam .env: sem AUTH_SECRET o getSessionContext/
// withApiGuards lançam. Default determinístico para os testes de unidade.
process.env.AUTH_SECRET ??=
  "test-secret-0123456789abcdef0123456789abcdef";