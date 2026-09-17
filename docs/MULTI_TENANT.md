# MULTI-TENANT — Estratégia de Isolamento e Contexto

> ADR: `docs/adr/ADR-0001`. Este documento detalha a operação.

## 1. Modelo de contexto

```
TenantContext {
  tenantId: string          // do JWT (sessão autenticada) — imutável na sessão
  storeId?: string          // UNIDADE ATUAL — seleção mutável, validada
  userId: string
  role: string
  permissions: string[]     // permissões efetivas para tenant + unidade atual
}
```

- **tenant atual**: identidade do tenant do usuário logado. Nunca muda na sessão.
- **unidade atual (`storeId`)**: seleção de contexto. O usuário pode **trocar de unidade
  sem logout** para qualquer unidade que tenha acesso.
- **unidades permitidas**: derivadas de `UserStore` (acesso explícito) ou de role
  tenant-wide com acesso global (ex.: ADMIN/GERENTE).
- **permissões por tenant**: as de `Role` do usuário (independentes de unidade).
  Role → `RolePermission` → `Permission` (join explícito com `tenantId`).
  `Role.globalStoreAccess=true` indica acesso a **todas** as unidades do tenant
  (ex.: ADMIN/GERENTE).
- **permissões por unidade**: `UserStore.storeRoleId` opcional — se presente, sobrepõe a
  role global **dentro daquela unidade**.

> Implementação: `AuthorizationService.resolve(ctx)` + `StoreSwitchService.authorizeSwitch`
> (Fase 2). A **rota HTTP** `POST /api/v1/session/store` é ligada na Fase 3 (Auth.js),
> reutilizando `authorizeSwitch` para validar `UserStore`/role antes de reemitir o token.

## 2. Proibição fundamental

`tenantId` e `storeId` **nunca** são aceitos do corpo, query string, headers ou params
da requisição para filtrar dados. Todo dado sensível é resolvido a partir da sessão e da
autorização. Params de URL (ex.: `/api/v1/products/:id`) identificam o **recurso**, mas
a query acrescenta o filtro do contexto.

## 3. Fluxo da requisição

```
Request → Session (Auth.js, token JWT) → TenantContext montado no server
 → authorize(permission)          // 403 se sem permissão na unidade atual
 → Service
 → TenantScopedRepository         // grava/consulta com WHERE tenantId/storeId forcados
 → DB
```

## 4. Sessão (Auth.js / NextAuth v5)

JWT contém apenas identidade e contexto resolvido no servidor:

```
token = {
  sub: userId,
  tenantId,
  storeId,          // unidade atualmente selecionada
  role,
  permissions: []   // calculadas no login/troca (cache curto)
}
```

O **storeId do token é a seleção atual**, não uma identidade. Callback `session()`
expõe `tenantId`, `storeId` e `permissions` ao servidor (e o mínimo necessário ao
cliente). Permissões podem ser revalidadas por middleware API a cada requisição
sensível (defesa em profundidade) quando conveniente.

## 5. Troca de unidade sem logout

Endpoint `POST /api/v1/session/store { storeId }`:

1. Valida que `storeId` existe e pertence a `tenantId` da sessão.
2. Valida que o usuário tem acesso à unidade (`UserStore` presente **ou** role com
   acesso global a todas as unidades).
3. Resolve as permissões efetivas para a nova unidade.
4. Emite novo token/atualiza cookie com `storeId` (e permissões) atualizados.
5. Registra `AuditLog` (`STORE_SWITCHED`).

Negado (401/403) se a unidade não existir, não pertencer ao tenant, ou o usuário não
tiver acesso. **Nunca** é aceita `storeId` "à vontade".

## 6. Autorização — permissões

Permissões no formato `<recurso>.<acao>` (ver `docs/SECURITY.md`). Resolução efetiva:

```
effectivePermissions(user, storeId?) =
  (se userStore(storeId).storeRole existe)
     → permissions de storeRole
  senão
     → permissions de role global do usuário
```

Se pontuado tanto role global quanto role da unidade: **role da unidade vence** (regra
única, documentada aqui; sem magic em handlers).

## 7. Repositórios tenant-scoped

Classe base obrigatória para todo repositório de entidade tenant/porta:

```ts
abstract class TenantScopedRepository {
  constructor(protected ctx: TenantContext) {}
  protected scope(where) { return { ...where, tenantId: this.ctx.tenantId } }
  protected scopeStore(where) { return { ...where, tenantId: this.ctx.tenantId, storeId: this.ctx.storeId! } }
}
```

> Implementado em F2 (F2-05): `TenantRepository`, `UserRepository`, `AccessRepository`,
> `AuditLogRepository` — todos herdam `TenantScopedRepository` e nunca aceitam
> `tenantId`/`storeId` como parâmetro livre.

- Repositórios **não expõem** método que aceite `tenantId`/`storeId` como parâmetro.
- Nenhum `prisma.X.findFirst({ where: { id } })` sem `scope()`.
- Anti-pattern proibido: `WHERE id = ?` sem filtro de tenant em entidade TenantScoped.

## 8. RLS — defesa em profundidade OPcional

- A aplicação **funciona integralmente sem RLS**.
- RLS pode ser habilitada como camada extra de hardening (policy por `tenantId` lido de
  variável de sessão), **configurável/off por padrão**, documentada — por ser recurso
  PostgreSQL, nunca é o mecanismo de isolamento (portabilidade SQL Server, ADR-0005).
- Isolamento primário: **Session → TenantContext → Authorization → TenantScopedRepository → Query**.

## 9. Isolamento também em

- **Cache/offline (IndexedDB)**: chave `tenantId:storeId:deviceId`; logout limpa dados
  sensíveis; blob de outro tenant jamais é servido.
- **Sync**: fila e pull/push sempre filtrados por `tenantId` da sessão.
- **Auditoria**: `AuditLog` carrega `tenantId` (+`storeId` quando conhecida).

## 10. Testes de isolamento (obrigatórios, F2-07)

- Criar 2 tenants (A, B) com dados distintos; usuário de A não deve ler/escrever nada de B.
- Toda rota sensível testada com ctx aleatório: esperar 401/403/404.
- Teste de item-filho sem JOIN vazando (p. ex. `SaleItem` de B via id de A → 404).
- Rodar sempre após mudanças em repositórios/rotas (CI).