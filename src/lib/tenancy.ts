// Multi-tenant onboarding: Institution ID generation, self-service institution
// creation with owner bootstrap + default provisioning, and join-existing.
// Every write is a transaction so a half-provisioned tenant never persists.

import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { audit } from "./audit";
import { notify } from "./notify";
import { ensurePermissionCatalog, seedTenantPermissions } from "./permissions";
import { getBillingState } from "./billing";
import { nextSequence } from "./sequence";
import { assignManexaId } from "./manexa-id";
import { seedChartOfAccounts } from "./accounting";
import { BRAND_GREEN } from "./design-system";
import { Prisma } from "@prisma/client";

export const INSTITUTION_TYPES = [
  { value: "SCHOOL", label: "School", prefix: "SCH" },
  { value: "COLLEGE", label: "College", prefix: "COL" },
  { value: "UNIVERSITY", label: "University", prefix: "UNI" },
  { value: "COACHING", label: "Coaching Institute", prefix: "COA" },
  { value: "ACADEMY", label: "Academy", prefix: "ACA" },
  { value: "TRAINING", label: "Training Center", prefix: "TRN" },
  { value: "NGO", label: "NGO Education Center", prefix: "NGO" },
  { value: "SKILL", label: "Skill Development Institute", prefix: "SKL" },
] as const;

const PREFIX: Record<string, string> = Object.fromEntries(
  INSTITUTION_TYPES.map((t) => [t.value, t.prefix])
);

const ID_BASE = 100000; // MAN-XXX-100001 for the first of each type

// Concurrency-safe: atomic increment on a per-type counter row.
export async function generateInstitutionId(
  type: string,
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const prefix = PREFIX[type] ?? "ORG";
  // Self-healing + race-safe: atomically advance the per-type counter, then
  // verify the candidate ID is actually free. If the counter ever drifts behind
  // existing data (missing counter, re-seed, manual insert), we keep advancing
  // until we find a free ID — instead of blindly emitting a colliding one. The
  // unique constraint on Tenant.institutionId remains the final safety net.
  for (let attempt = 0; attempt < 100; attempt++) {
    const counter = await tx.institutionCounter.upsert({
      where: { type },
      update: { next: { increment: 1 } },
      create: { type, next: 2 }, // create → next=2 so the first ID uses (next-1)=1
    });
    const seq = counter.next - 1;
    const candidate = `MAN-${prefix}-${ID_BASE + seq}`;
    const clash = await tx.tenant.findUnique({ where: { institutionId: candidate }, select: { id: true } });
    if (!clash) return candidate;
    // Candidate already exists → counter was behind. Loop advances it and retries.
  }
  throw new Error(`Could not allocate a unique institution ID for type ${type}`);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30);
}

async function uniqueSubdomain(base: string, tx: Prisma.TransactionClient): Promise<string> {
  let sub = slugify(base) || "inst";
  let n = 0;
  // Collisions are rare; append a counter if needed.
  while (await tx.tenant.findUnique({ where: { subdomain: n ? `${sub}-${n}` : sub } })) n++;
  return n ? `${sub}-${n}` : sub;
}

export interface CreateInstitutionInput {
  institutionName: string;
  type: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  password: string;
  country?: string;
  state?: string;
  city?: string;
  website?: string;
  logoUrl?: string;
}

// Opaque unique id (cuid-shaped) generated in-process so we can batch classes
// and their sections with createMany — no round-trip to read ids back.
const cid = () => "c" + randomBytes(12).toString("hex");

export async function createInstitution(input: CreateInstitutionInput) {
  const email = input.ownerEmail.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("An account with this email already exists. Sign in instead.");
    (err as any).code = "EMAIL_TAKEN";
    throw err;
  }
  await ensurePermissionCatalog();
  const passwordHash = await hashPassword(input.password);
  const year = new Date().getFullYear();
  const academicYear = `${year}-${year + 1}`;

  // Generate the institution ID + subdomain OUTSIDE the transaction. The atomic
  // counter (generateInstitutionId) and the tenant unique constraints are the
  // real guards — doing this inside the tx added round-trips that, at real
  // pooler latency, blew past Prisma's 5s interactive-transaction timeout and
  // failed every signup ("Transaction already closed"). This is the root-cause
  // fix: keep the transaction tiny (5 round-trips) and give it real headroom.
  const institutionId = await generateInstitutionId(input.type);
  const subdomain = await uniqueSubdomain(input.institutionName, prisma);

  // A starter set of classes with one section each, so the institution is
  // immediately usable. Pre-assign ids so both createMany calls are batched.
  const defaultClasses =
    input.type === "SCHOOL"
      ? ["Class I", "Class II", "Class III", "Class IV", "Class V"]
      : input.type === "COACHING"
      ? ["Batch A", "Batch B", "Batch C"]
      : ["Year 1", "Year 2", "Year 3"];
  const classes = defaultClasses.map((name) => ({ id: cid(), name }));

  const result = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          institutionId,
          name: input.institutionName,
          subdomain,
          code: institutionId.split("-").slice(1).join(""),
          type: input.type,
          country: input.country ?? "India",
          state: input.state,
          city: input.city,
          website: input.website,
          email,
          academicYear,
          status: "ACTIVE",
          // 14-day trial by default; billing later attaches a real plan.
          subscriptionExpiry: new Date(Date.now() + 14 * 24 * 3600 * 1000),
          // Default tenant brand = MANEXA accent; institutions can override it.
          primaryColor: BRAND_GREEN,
        },
      });

      const owner = await tx.user.create({
        data: {
          email,
          phone: input.ownerMobile,
          passwordHash,
          displayName: input.ownerName,
          role: "INSTITUTION_ADMIN", // institution owner / super admin of their org
          status: "ACTIVE",
          provider: "LOCAL",
          emailVerifiedAt: new Date(), // self-serve owner is trusted on creation
          tenantId: tenant.id,
        },
      });

      await tx.tenant.update({ where: { id: tenant.id }, data: { ownerId: owner.id } });
      // Institution owner is an Administrator → e.g. DPS-ADM-001.
      await assignManexaId(tx, { userId: owner.id, tenantId: tenant.id, role: "INSTITUTION_ADMIN" });
      // Seed the institution's default chart of accounts for double-entry books.
      await seedChartOfAccounts(tenant.id, tx);

      // Batched provisioning — 2 round-trips for all classes + sections
      // (was 2 per class in a loop).
      await tx.class.createMany({
        data: classes.map((c) => ({ id: c.id, tenantId: tenant.id, name: c.name })),
      });
      await tx.section.createMany({
        data: classes.map((c) => ({ tenantId: tenant.id, classId: c.id, name: "A", capacity: 40 })),
      });

      return { tenant, owner };
    },
    // Generous headroom for pooler latency; the body is only 5 round-trips so
    // this is a safety margin, not a crutch.
    { timeout: 20_000, maxWait: 10_000 }
  );

  // Idempotent provisioning outside the tx (can() falls back to the default
  // matrix if this ever fails, so it never blocks the owner from working).
  await seedTenantPermissions(result.tenant.id);

  await audit({
    tenantId: result.tenant.id,
    actorId: result.owner.id,
    action: "INSTITUTION_CREATE",
    entity: "Tenant",
    entityId: result.tenant.id,
    detail: `${result.tenant.institutionId} · ${input.type}`,
  });

  // Welcome notification (best-effort; push fan-out is deferred inside notify).
  await notify({
    tenantId: result.tenant.id,
    userId: result.owner.id,
    kind: "system",
    title: "Welcome to MANEXA 🎉",
    body: `${result.tenant.name} is ready. Your Institution ID is ${result.tenant.institutionId} — share it so staff and parents can join.`,
    href: "/institution",
  }).catch(() => {});

  return result;
}

export const JOINABLE_ROLES = [
  { value: "TEACHER", label: "Teacher" },
  { value: "PARENT", label: "Parent / Guardian" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "TRANSPORT_MGR", label: "Transport Manager" },
  { value: "HR", label: "HR / Staff" },
] as const;

export interface JoinInstitutionInput {
  institutionId: string;
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: string;
}

export async function joinInstitution(input: JoinInstitutionInput) {
  const tenant = await prisma.tenant.findUnique({
    where: { institutionId: input.institutionId.trim().toUpperCase() },
  });
  if (!tenant) {
    const err = new Error("No institution found with that ID. Check the ID with your admin.");
    (err as any).code = "INVALID_INSTITUTION";
    throw err;
  }
  if (tenant.status !== "ACTIVE") {
    const err = new Error("This institution is not currently active.");
    (err as any).code = "INSTITUTION_INACTIVE";
    throw err;
  }
  // Block new joins once the subscription has lapsed past its grace window —
  // a lapsed institution must renew before it can grow. (Read access for
  // existing members is unaffected; this only gates new-member creation.)
  const billing = await getBillingState(tenant.id);
  if (!billing.writable) {
    const err = new Error("This institution's subscription has expired. Ask your admin to renew before joining.");
    (err as any).code = "SUBSCRIPTION_EXPIRED";
    throw err;
  }
  // Staff-type joins consume a staff seat — without this check the join flow
  // bypassed the plan's staff cap entirely.
  const STAFF_JOIN_ROLES = new Set(["TEACHER", "HR", "LIBRARIAN", "TRANSPORT_MGR", "ACCOUNTANT"]);
  if (STAFF_JOIN_ROLES.has(input.role)) {
    const limit = billing.limits.staff;
    if (limit !== null && billing.usage.staff >= limit) {
      const err = new Error("This institution's staff seats are full. Ask your admin to upgrade the plan.");
      (err as any).code = "SEAT_LIMIT";
      throw err;
    }
  }
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    const err = new Error("An account with this email already exists. Sign in instead.");
    (err as any).code = "EMAIL_TAKEN";
    throw err;
  }
  const validRole = JOINABLE_ROLES.some((r) => r.value === input.role);
  if (!validRole) throw new Error("Invalid role selection");

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        phone: input.mobile,
        passwordHash,
        displayName: input.name,
        role: input.role,
        // Joins land PENDING → the institution admin approves in User management.
        status: "PENDING",
        provider: "LOCAL",
        tenantId: tenant.id,
      },
    });
    // Attach the role-specific record so approval is the only remaining step.
    if (input.role === "TEACHER" || input.role === "HR" || input.role === "LIBRARIAN" || input.role === "TRANSPORT_MGR" || input.role === "ACCOUNTANT") {
      const seq = await nextSequence(
        tenant.id,
        "employee",
        () => tx.staff.count({ where: { tenantId: tenant.id } }),
        tx
      );
      await tx.staff.create({
        data: {
          tenantId: tenant.id,
          userId: u.id,
          employeeCode: `EMP-${String(seq).padStart(4, "0")}`,
          designation: input.role,
          department: input.role,
        },
      });
      // Public MANEXA ID from the person's role (e.g. DPS-T-001, DPS-FIN-001).
      await assignManexaId(tx, { userId: u.id, tenantId: tenant.id, role: input.role });
    } else if (input.role === "PARENT") {
      await tx.parent.create({ data: { tenantId: tenant.id, userId: u.id, relation: "GUARDIAN" } });
    }
    return u;
  });

  await audit({
    tenantId: tenant.id,
    actorId: user.id,
    action: "INSTITUTION_JOIN_REQUEST",
    entity: "User",
    entityId: user.id,
    detail: `${input.role} · pending approval`,
  });

  return { tenant, user };
}
