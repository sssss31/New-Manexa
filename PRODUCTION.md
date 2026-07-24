# MANEXA — Production Engineering Guide

This document covers the 18 production dimensions (folder structure → future
scalability) platform-wide, and states plainly what is **live in this codebase**
vs **defined for the production deployment**.

## 1. Folder structure

```
src/
  app/                 # Route layer — thin. Auth → lib call → revalidate.
    {admin,institution,teacher,accounts,parent,student}/
      layout.tsx       # requireRole() gate + AppShell (RBAC boundary)
      loading.tsx      # skeleton loader (streaming fallback)
      actions.ts       # "use server" mutations — Zod-validated, audit-logged
      <module>/page.tsx
    notifications/     # cross-portal notification center
    print/             # chrome-less print documents (certificates, ID cards)
    api/health/        # k8s liveness/readiness probe
  components/          # AppShell, CommandK, DataTable, Skeleton, ui.tsx, Icons
  lib/                 # ALL business logic (service layer)
    engine.ts          # mutations + saga-style side effects
    ai.ts              # explainable scoring + NL query router
    auth.ts            # sessions, RBAC, password policy
    automation.ts      # event bus → rule engine → action library
    notify.ts audit.ts rate-limit.ts format.ts
prisma/                # schema (43 models), seed
k8s/ Dockerfile docker-compose.yml .github/workflows/
```

The `lib/` modules map 1:1 to the SAD's microservice inventory — `engine.ts`
splits into fee-svc/sis-svc/exam-svc etc. along its existing function
boundaries when scale demands it.

## 2. Components
Server Components by default; client islands only where interactivity demands
(`CommandK`, `DataTable`, `ThemeToggle`, `PrintButton`). Framer Motion powers
the palette; CSS keyframes (`animate-fade-up`, `animate-pop`, shimmer) cover
page/table/skeleton motion at zero bundle cost.

## 3. Database schema
43 models, FK relations throughout, `@@index` on every hot path
(tenantId+status, tenantId+date, tenantId+dueDate, tenantId+stage,
tenantId+createdAt). Soft delete (`deletedAt`) on User/Student/Staff.
Audit columns on all business models. Money = INR integers.
**Dev:** SQLite. **Prod:** switch `provider = "postgresql"` in schema.prisma —
zero model changes required; then `prisma migrate deploy` (migration files
generated per release; `db push` is dev-only).

## 4. API routes
UI mutations go through Server Actions (CSRF-safe by origin-check design,
POST-only). `/api/health` for probes. Public REST/GraphQL per SAD §7 is the
Phase-3 surface — handlers mount under `app/api/v1/` reusing `lib/` untouched.

## 5. Validation
Zod at every boundary that accepts free-form input (tenant/plan/banner forms),
typed coercion elsewhere; unknown fields rejected. Engine functions re-verify
invariants (capacity, non-negative stock, already-paid) server-side.

## 6. Business logic
Only in `src/lib/` — routes never touch Prisma for writes. Every mutation:
authenticate → authorize (role + tenant scope) → validate → mutate → audit →
notify/publish events → revalidate.

## 7-8. UI layout & responsive
8px spacing system, 16px radii, 1400px max content width, sidebar + header
shell; grids collapse mobile-first (`grid-cols-2 md:grid-cols-4`); tables
scroll within `.table-wrap` so the page never scrolls horizontally.

## 9. State management
Server state lives on the server (RSC). Client state is minimal and local
(palette open/close, table sort/filter). No global client store needed at
this surface area — Zustand/React Query slot in when live dashboards (SSE)
arrive in Phase 3.

## 10. Permissions
Five-tier RBAC. Enforcement points: (1) layout `requireRole`, (2) every query
scoped by `tenantId` + owner id, (3) parent/student verified-ownership checks
(e.g. `payInvoiceAsParent` re-verifies the parent-student link). The matrix is
published in-product at Institution → Roles & permissions.

## 11. Loading states
`loading.tsx` skeleton per portal (streamed by Next). Shimmer skeletons match
final layout to avoid layout shift.

## 12. Error handling
Global `error.tsx` boundary with retry + digest ref. Engine functions throw
typed errors; actions fail closed (no partial writes on validation failure).

## 13. Edge cases handled
Double payment blocked; hostel over-allocation blocked; negative stock
blocked; duplicate attendance upserts; rate-limited login; empty states on
every list; Sunday-aware attendance seed; broadcast vs targeted notifications.

## 14. Security
- Sessions: httpOnly, SameSite=Lax cookies; DB-backed, 14-day expiry, token
  rotation on login. (JWT+refresh per SAD §8.3 arrives with the public API —
  cookie sessions are the correct choice for a same-origin app.)
- Headers: CSP, X-Frame-Options DENY, nosniff, Referrer-Policy,
  Permissions-Policy, HSTS (prod) — set in `middleware.ts`.
- Rate limiting: sliding window on login (5/5min/account) — Redis-backed in
  prod via the same interface.
- Password policy (8+ chars, upper/lower/digit) on new accounts; bcrypt cost 10.
- Injection: Prisma parameterized queries only; no raw SQL; React escapes
  output (XSS); the only `dangerouslySetInnerHTML` is the static theme script.
- Audit: append-only log of every auth/money/data action, exportable CSV.
- 2FA: schema-ready (`mfaEnabled`); TOTP enrolment is the next security sprint.

## 15. Performance
RSC-first (tiny client bundle), route-level code splitting, streaming with
skeleton fallbacks, indexed queries, capped result sets + client pagination,
`next/font` self-hosted fonts (zero external requests). Prod: Redis cache
for dashboard aggregates, BullMQ for automation fan-out, CloudFront CDN.

## 16. Testing strategy
CI (GitHub Actions): type check → build → schema push → full seed (exercises
every engine path: admission, invoicing, payments, marks, hostel, inventory).
Next: Vitest unit tests for `lib/ai.ts` + `lib/engine.ts` invariants,
Playwright golden-path E2E (lead → admit → attend → pay → publish).

## 17. Deployment
Docker multi-stage (non-root, healthcheck) → docker-compose parity stack
(app + Postgres 16 + Redis 7) → k8s: 3-replica Deployment, HPA 3→30 pods at
65% CPU, zero-downtime rolling updates, NGINX ingress + cert-manager TLS,
probes on `/api/health`. CI builds/pushes the image; ArgoCD syncs (per SAD §9.4).

## 18. Future scalability
The monolith split line is `src/lib/` module boundaries → SAD's 24 services.
Order: fee-svc first (peak-load isolation), then comms-svc (queue-heavy),
then analytics (ClickHouse CDC pipeline). Tenancy already supports the
Pooled→Bridge→Silo ladder in the data model. 100k concurrent users =
HPA width on stateless pods + Postgres read replicas + Redis cache — no
application rewrites required because state already lives outside the app.

## Honest deferred list
Chat threads, TOTP enrolment UI, column resize on DataTable, autosave/undo on
forms, Terraform modules, Grafana/Prometheus dashboards (probe endpoint +
structured logging are in place), real LLM assistant backend (interface ready),
Razorpay/MSG91 live adapters (simulated by design in this environment).
