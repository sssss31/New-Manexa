// Multi-tenant onboarding: Institution ID generation, self-service institution
// creation with owner bootstrap + default provisioning, and join-existing.
// Every write is a transaction so a half-provisioned tenant never persists.

import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { audit } from "./audit";
import { ensurePermissionCatalog, seedTenantPermissions } from "./permissions";
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

  const result = await prisma.$transaction(async (tx) => {
    const institutionId = await generateInstitutionId(input.type, tx);
    const subdomain = await uniqueSubdomain(input.institutionName, tx);

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
        primaryColor: "#B6FF2A",
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

    // ---- Default provisioning ----
    // A starter set of classes with one section each, so the institution is
    // immediately usable (students can be admitted, timetables built).
    const defaultClasses =
      input.type === "SCHOOL"
        ? ["Class I", "Class II", "Class III", "Class IV", "Class V"]
        : input.type === "COACHING"
        ? ["Batch A", "Batch B", "Batch C"]
        : ["Year 1", "Year 2", "Year 3"];
    for (const name of defaultClasses) {
      const cls = await tx.class.create({ data: { tenantId: tenant.id, name } });
      await tx.section.create({ data: { tenantId: tenant.id, classId: cls.id, name: "A", capacity: 40 } });
    }

    return { tenant, owner };
  });

  // Default role permissions (outside the tx to keep it short; idempotent).
  await seedTenantPermissions(result.tenant.id);

  await audit({
    tenantId: result.tenant.id,
    actorId: result.owner.id,
    action: "INSTITUTION_CREATE",
    entity: "Tenant",
    entityId: result.tenant.id,
    detail: `${result.tenant.institutionId} · ${input.type}`,
  });

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
      const count = await tx.staff.count({ where: { tenantId: tenant.id } });
      await tx.staff.create({
        data: {
          tenantId: tenant.id,
          userId: u.id,
          employeeCode: `EMP-${String(count + 1).padStart(4, "0")}`,
          designation: input.role,
          department: input.role,
        },
      });
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
