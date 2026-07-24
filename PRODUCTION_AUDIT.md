# MANEXA — Production Audit & Deployment Report

_Consolidated audit against the enterprise-hardening brief. States plainly what
is verified, what was fixed this pass, and what remains._

## 1. Build-fix report (Vercel deployment) — RESOLVED

**Root cause of the failed Vercel build:** `Module not found: Can't resolve
'@prisma/client'`. Vercel caches `node_modules` and does **not** run
`prisma generate`; the project had no `postinstall`, so the Prisma Client was
never generated on Vercel. Reproduced locally by deleting the generated client
and building.

**Fixes:**
- `package.json`: `"postinstall": "prisma generate"` **and** `"build": "prisma generate && next build"` (belt-and-suspenders).
- `src/lib/env.ts`: build-phase resilience — `next build` no longer crashes when
  secrets are absent (placeholders during `phase-production-build`; **runtime
  validation stays strict**). Type-safety and validations were NOT weakened.
- `engines.node >= 20` + `.nvmrc` (`20`) to pin the Vercel runtime.

**Verified (Vercel-style: no pre-generated client, no env vars):**
`✔ Generated Prisma Client` → `✓ Compiled successfully` → standalone output present.

## 2. Deployment report — Vercel checklist
1. **Root Directory** = the `Manexa.c` folder (if the repo nests it).
2. **Build Command** = default (`npm run build`) · **Install** = default (`npm install`, runs `postinstall`).
3. **Env vars** (Project → Settings → Environment Variables): `DATABASE_URL`
   (**Supabase pooler, port 6543, `?pgbouncer=true&connection_limit=1`**),
   `DIRECT_URL` (direct 5432, migrations only), `SESSION_SECRET`
   (`openssl rand -base64 48`), optional `FACE_ENC_KEY`, `SUPERADMIN_EMAIL/PASSWORD`.
   Do **not** set `NEXT_PUBLIC_DEMO_MODE` in prod.
4. **Migrations** run out-of-band: `prisma migrate deploy` (CI or one-off), not at build.
5. **Serverless + Prisma:** the pooled `DATABASE_URL` is mandatory — the direct
   connection exhausts under concurrency → runtime crashes. Fixed via the
   `directUrl` datasource split. Template in `.env.production.example`.

## 3. Security audit (OWASP-aligned) — findings & posture
| Area | Status |
|---|---|
| **A01 Broken Access Control** | **1 real leak found & FIXED**: the student dashboard's "upcoming assignments" query had no tenant scope → returned assignments across all institutions. Now scoped via `course.tenantId`. Added defense-in-depth `tenantId` to the student exams query. |
| **A02 Cryptographic Failures** | bcrypt (cost 10) passwords; AES-256-GCM face embeddings, never sent to client; httpOnly SameSite cookies; DB sessions. |
| **A03 Injection** | Prisma parameterized queries only; no raw SQL; React auto-escapes (XSS); the only `dangerouslySetInnerHTML` is the static theme script. |
| **A04 Insecure Design** | Multi-tenant by construction; server actions re-verify ownership; forward-only trip/lifecycle state machine. |
| **A05 Security Misconfiguration** | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (prod) in `middleware.ts`; `poweredByHeader:false`. |
| **A07 Auth Failures** | Login rate-limit (5/5min), failed-login audit + `LoginEvent` (IP/UA), password policy, PENDING-account gate. |
| **A08 Integrity** | Env validated at boot (`src/lib/env.ts`); placeholder secret blocked in prod runtime. |
| **A09 Logging** | `audit()` on every auth/money/data action; `LoginEvent` history; API errors return generic messages (no stack leakage). |
| **Secrets** | `.env*` gitignored (only `*.example` committed); embeddings/secrets server-only; no secret reaches the browser. |

## 4. Multi-tenant isolation
314 Prisma calls reviewed. Every business query is scoped by `tenantId` or an
owner id (`userId`/`studentId`/`classId`-as-cuid). Platform-admin (`SUPER_ADMIN`)
counts are intentionally cross-tenant. The one unscoped query (assignments) is
fixed. `requireRole()` gates every layout; `can()` (DB-driven RBAC) gates actions.

## 5. Database report
PostgreSQL only (SQLite rejected by env validation). Versioned migrations
(`prisma/migrations/`), `@@index` on hot paths, FKs + cascades, soft-delete
(`deletedAt`) + audit columns, `institutionId`+`tenantId` on records. Serverless
pooling via `directUrl`. **RLS note:** isolation is enforced at the **application
layer** (every query scoped), not Postgres Row-Level Security — see Remaining risks.

## 6. Success criteria — all green
`prisma validate` ✓ · `prisma generate` ✓ · `tsc --noEmit` ✓ · `next lint` ✓
(no warnings) · `npm run build` ✓ (clean, Vercel-style) · migrate status ✓ ·
health endpoint ✓. No suppressed errors, no disabled checks, no reduced type safety.

## 7. Remaining risks / honest deferrals
- **Postgres RLS** not enabled — isolation is app-layer (robust, but defense-in-depth
  would add Supabase RLS policies keyed on `institution_id`).
- **MFA/TOTP, real OAuth (Google/MS), magic-link, email verification** — schema
  fields exist; flows are not wired (need an IdP/SMTP).
- **Sentry / Grafana / Prometheus** — health/readiness endpoint + structured audit
  exist; external monitoring not connected.
- **Automated tests** — CI runs typecheck + build + seed; no unit/e2e suite yet.
- **Rotate the Supabase DB password + any keys pasted during development.**
- External services (Razorpay/MSG91/Maps/ArcFace) are simulated/pluggable by design.
