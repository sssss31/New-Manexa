# MANEXA

AI-Powered School Management System — commercial, multi-tenant, neon-on-black.

> Production engineering guide (security, performance, DevOps, scaling, testing):
> **[PRODUCTION.md](PRODUCTION.md)** · Deploy: `docker compose up --build` · k8s manifests in `k8s/`
>
> AI Face Attendance module (18-point deliverable breakdown, recognition swap-in path):
> **[FACE_ATTENDANCE.md](FACE_ATTENDANCE.md)**

Runnable MVP monolith that mirrors the [SRS v2.0](../MANEXA_SCMS_SRS_v2.0%20\(2\).docx)
and [SAD v1.0](../MANEXA_SCMS_Architecture_v1.0%20\(1\).docx). It can later be split
into the SAD's 24 microservices; the same domain APIs live in `src/lib/` today.

## Quick start

**Option A — Docker (fresh machine, one command):** starts Postgres + Redis + app,
applies migrations automatically.

```bash
cp .env.example .env         # optional; compose has working defaults
docker compose up --build    # → http://localhost:3000
docker compose run --rm seed # load demo data (first run only)
```

**Option B — local Node** (against a Postgres you provide — local or Supabase):

```bash
cp .env.example .env         # then set DATABASE_URL + SESSION_SECRET
npm install
npm run setup                # prisma generate + migrate deploy + seed
npm run dev                  # → http://localhost:3000
```

`make up` / `make dev` wrap these. Re-seed at any time: `npm run db:reset`.

### Verify a change
```bash
npm run typecheck && npm run lint && npm run build   # all must pass
npx prisma validate && npx prisma migrate status     # schema + migrations
```

### Database
PostgreSQL only (SQLite is rejected by env validation). Schema changes are
versioned migrations (`prisma/migrations/`), applied with `npm run db:migrate`
(dev) or `npm run db:migrate:deploy` (prod/CI). Env is validated at boot by
`src/lib/env.ts`. Secrets live in `.env` (Prisma + Next read it); `.env.local`
is for Next-only overrides. Templates: `.env.example`, `.env.production.example`.

## Demo logins (password `password123`)

| Role                 | Email                                    | Portal             |
| -------------------- | ---------------------------------------- | ------------------ |
| Super Admin          | `super@manexa.test`                      | `/admin`           |
| Institution Admin    | `admin@stjohns.manexa.test`              | `/institution`     |
| Principal            | `principal@stjohns.manexa.test`          | `/institution`     |
| Teacher              | `teacher@stjohns.manexa.test`            | `/teacher`         |
| Accountant           | `accountant@stjohns.manexa.test`         | `/accounts`        |
| Parent               | `parent@stjohns.manexa.test`             | `/parent`          |
| Student              | `student@stjohns.manexa.test`            | `/student`         |

Three tenants are seeded: **St. John's Academy** (Pro), **DPS Pune** (Enterprise),
**Bright Buds Coaching** (Standard).

## Stack

- **Next.js 15 App Router** · TypeScript · Tailwind
- **Prisma + SQLite** (Postgres/Mongo in prod, per SAD polyglot data tier)
- Cookie sessions + bcrypt · Zod at edges
- Dark-first UI, CSS-variable tokens, semantic classes
- Business logic lives in `src/lib/` (services), not in routes

## Architecture (as-built)

```
src/
  app/               # 7 role-scoped portals, server actions, layouts
    admin/           # Super Admin — tenants, plans, subs, banners, audit
    institution/     # Institution Admin / Principal — cockpit + all masters
    teacher/         # Attendance · LMS · assignments · exams · timetable
    accounts/        # Invoices · collections · defaulters · payroll · reports
    parent/          # Child, attendance, results, fees, transport, notices
    student/         # Timetable, LMS, assignments, results, library, notices
    login/           # Cookie/session auth
  components/        # AppShell, Logo, ThemeToggle, ui.tsx, Icons
  lib/
    auth.ts          # requireRole, sessions, roleHome
    engine.ts        # All mutations: createLead, admitFromLead, markAttendance,
                     # createInvoice, payInvoice, submitAssignment, gradeSubmission,
                     # enterMarks, publishExam, runPayroll, issueBook, …
    automation.ts    # Simple event bus + action library (SEND_SMS/WHATSAPP/…)
    audit.ts         # Every mutation writes an append-only trail
    lifecycle.ts     # — (reserved) admission state machine
    format.ts        # INR formatter, dates, relative time
    parent-data.ts   # Loader for parent → child fanout
  middleware.ts      # Sets x-pathname header for AppShell active state
prisma/
  schema.prisma      # 40+ models across 28 MANEXA modules (MVP subset)
  seed.ts            # 3 tenants · 60 students · 3 months of invoices &
                     # payments · courses · lessons · assignments · exams
                     # with published marks · library loans · notices ·
                     # 5 automations · audit log
```

## Modules implemented (Phase 1 + a slice of 2 & 3)

Identity & Tenancy · **LEAD/CRM & Admission** · SIS · Class/Section/Subject ·
Timetable · **Attendance** (offline-safe pattern) · **LMS** (courses, lessons,
assignments, grading) · **Examination & Results** · **Fee Management** · Payroll
(light) · Communication (simulated SMS/WhatsApp) · Notices · Transport (fleet
+ routes + allocations) · Library (catalog + loans + fines) · Automation Engine
· Audit · Analytics (per-role dashboards) · Banners · Subscription plans.

## Golden path

1. Institution Admin captures a LEAD → advances stages → admits into Class VI A.
2. Admission creates the student, parent user, and initial fee invoice.
3. Teacher marks attendance → absentee event fires the SMS-to-parent automation.
4. Parent signs in → sees dues → pays invoice via UPI → payment recorded,
   ledger updated, thank-you WhatsApp automation runs.
5. Teacher enters FA1 marks → publishes exam → result-published event fires,
   parent sees results.
6. Every mutation is audit-logged and visible under Admin → Audit Log.

## Dev notes

- Never run `next build` against a running dev server (corrupts `.next`).
- Money is INR integers throughout; use `inr()` for display.
- Multi-tenancy at application layer via mandatory `tenantId` on every query.
