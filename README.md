# University ERP — Foundation

Next.js (App Router) + PostgreSQL foundation for the University ERP, covering four modules:
**User Management**, **Attendance Management**, **Examination & Result Management**, and **Fee & Payment Management**.

This is the *foundation layer* — database schema, auth, RBAC, and one representative API route per
module — built so every subsequent feature has a consistent base to extend. It is not a finished
product; see "What's next" at the bottom.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | Full-stack in one codebase per your request |
| Database | PostgreSQL | Relational integrity for academic/financial records |
| ORM | Drizzle ORM (`drizzle-orm` + `pg`) | **Not Prisma** — this sandbox couldn't reach Prisma's binary-engine CDN, and Drizzle is pure TypeScript (no native engine to download), equally type-safe, and a strong fit for Next.js. Swap back to Prisma later if you prefer; the schema design translates directly. |
| Auth | NextAuth.js v5 (Auth.js), Credentials provider, JWT sessions | Matches the Master Plan's JWT-based auth decision |
| Validation | Zod | Request body validation on every mutating route |
| Passwords | bcryptjs | Salted adaptive hashing, as specified in the SRS (NFR-SEC-01) |

## Project structure

```
src/
  db/
    schema/
      enums.ts          # all pgEnum definitions (roles, statuses)
      _helpers.ts        # shared id/timestamp/soft-delete column helpers
      identity.ts        # users, parentLinks, passwordResetTokens        [User Management]
      academic.ts         # department -> program -> batch, course -> offering -> section
      people.ts           # students, faculty, facultyAssignments        [User Management]
      enrollment.ts        # enrollments (aggregate root)
      attendance.ts         # attendanceRecords                          [Attendance Management]
      assessment.ts          # templates, components, marks, grading policy
      examination.ts          # examinations, results, revaluationRequests [Examination & Result]
      fees.ts                  # feeStructures, invoices, payments, scholarships [Fee & Payment]
      crosscutting.ts            # notifications, auditLogEntries
      index.ts                    # barrel export — single import surface
    index.ts              # Drizzle client singleton (pooled pg.Pool)
  lib/
    auth.ts        # NextAuth v5 config (credentials provider, account lockout, JWT callbacks)
    rbac.ts         # role -> permission map + requirePermission()/requireAnyRole() guards
    audit.ts         # recordAudit() — the only way audit_log_entries rows are ever written
    password.ts        # bcrypt hash/verify helpers
  middleware -> proxy.ts   # route-level RBAC gate (Next.js 16 "proxy" convention), + auth redirect
  app/
    login/page.tsx    # minimal sign-in form
    page.tsx           # role-aware landing page (proves session + RBAC plumbing works)
    api/
      users/route.ts              # [User Management]       list/create users
      attendance/route.ts          # [Attendance Management]  record attendance, ownership-scoped
      exams/marks/route.ts          # [Examination & Result]   enter/submit marks
      exams/results/[id]/publish/   # [Examination & Result]   publish (immutability-enforcing)
      fees/payments/route.ts          # [Fee & Payment]          record a payment against an invoice
scripts/
  seed.ts     # seeds one demo account per role + a full sample academic/fee dataset
drizzle/
  0000_*.sql    # generated migration — 32 tables, already validated against this schema
docker-compose.yml   # local Postgres only
scripts/init-extensions.sql  # enables pgcrypto for gen_random_uuid()
```

## Database design highlights

- **32 tables**, organized by module (see schema file list above). Full ERD-level detail already exists in the project's Master Plan/SRS documents — this schema implements that design directly.
- **UUID primary keys** (`gen_random_uuid()` via the `pgcrypto` extension — enabled automatically by `scripts/init-extensions.sql` when using `docker-compose up`).
- **Append/version pattern on `assessment_marks` and `results`** — neither table has an UPDATE path for a `submitted`/`published` row in the application code. A correction inserts a new row (`version + 1`, `supersedesResultId` pointing at the prior row) and marks the old row `superseded`. This is the single most important integrity rule in the whole system — see `src/app/api/exams/results/[resultId]/publish/route.ts` for where it's enforced.
- **`audit_log_entries` is insert-only** — there is no update/delete function for it anywhere in `src/lib/audit.ts` or elsewhere in the codebase, by design (FR-AUD-03).
- **Grading is configuration, not code** — `grading_policies` + `grade_bands` + `assessment_templates` + `assessment_components` let every program define its own weightages and grade boundaries without touching application code.
- **Fee & Payment module** (new in this build, not detailed in earlier docs): `fee_structures` → `fee_components` define what a Program/Semester costs; `invoices` are generated per student per semester; `payments` support partial payment against an invoice with running `amount_paid`/`status` tracking; `scholarships` apply a discount.

## Getting started

```bash
# 1. Start Postgres locally
docker compose up -d

# 2. Configure environment
cp .env.example .env
# (defaults in .env.example already match docker-compose.yml, generate a real AUTH_SECRET for anything beyond local dev)

# 3. Install dependencies
npm install

# 4. Apply the database schema
npm run db:migrate

# 5. Seed demo data (one account per role, password: Password123!)
npm run db:seed

# 6. Run the app
npm run dev
```

Visit `http://localhost:3000/login`. Seeded accounts: `superadmin@erp.test`, `admin@erp.test`,
`registrar@erp.test`, `hod@erp.test`, `examctrl@erp.test`, `faculty@erp.test`, `student@erp.test`,
`parent@erp.test` — all with password `Password123!`.

Useful scripts:
- `npm run db:generate` — regenerate the SQL migration after changing `src/db/schema/*`
- `npm run db:studio` — Drizzle Studio, a visual browser for the database
- `npm run lint` / `npx tsc --noEmit` — both pass cleanly as of this commit

## RBAC model

Two layers, matching the Master Plan's conclusion that RBAC alone isn't sufficient:

1. **Coarse-grained (`src/lib/rbac.ts`)** — a static role → permission map, checked first in every route handler (`requirePermission(session, "enter_marks")`) and again at the route-prefix level in `src/proxy.ts`.
2. **Ownership/scoping (inline in each route handler)** — e.g. `api/attendance/route.ts` additionally checks that the authenticated faculty user actually holds a `facultyAssignments` row for the target section before allowing the write; `api/fees/payments/route.ts` checks a student can only pay their own invoice. This can't be expressed as a static role→permission table, which is exactly why the Master Plan calls for this second layer.

## Known gaps to close next (explicitly out of scope for this foundation pass)

- `api/exams/marks` does not yet re-verify faculty-to-section ownership the same way `api/attendance` does (noted inline in the route file) — same pattern, just not duplicated here yet.
- No marks-verification (`verify`/`reject`) or result-computation (`compute`) routes yet — only submission and publish are implemented as representative examples.
- No `GradingStrategy` computation logic (Strategy pattern from the Class Diagram) — `grading_policies.strategyType` exists in the schema but nothing reads it yet.
- No dashboards, notifications dispatch, or role-scoped UI beyond the single landing page.
- `onConflictDoUpdate` in `api/attendance` loops per-row inside a transaction rather than a single bulk statement — correct, but worth revisiting for very large class sizes.
- Database-level hardening mentioned in the Master Plan (a restricted DB role that physically cannot UPDATE/DELETE `audit_log_entries`) is not yet set up — currently enforced only at the application layer.

## Why Drizzle instead of Prisma

The Master Plan recommended Prisma. This sandbox's network allowlist doesn't include
`binaries.prisma.sh`, which Prisma's CLI needs to download its query-engine binary — so `prisma
init`/`generate` fails here regardless of code correctness. Drizzle has no such binary dependency
(pure TypeScript, talks to Postgres via `pg` directly) and is a well-regarded, actively maintained
alternative with equivalent type safety. If your actual deployment environment can reach Prisma's
CDN, switching back is a schema-rewrite, not a re-architecture — the table/column design here
carries over directly.
