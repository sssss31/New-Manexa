// ─────────────────────────────────────────────────────────────────────────
// MANEXA ID — the ONE centralized public-identifier service.
//
// Format:  [INSTITUTION_CODE]-[TYPE_CODE]-[SEQUENCE]   e.g.  DPS-S-001
//
//   • INSTITUTION_CODE  → Tenant.code (already unique per institution)
//   • TYPE_CODE         → the person's coarse, immutable classification
//   • SEQUENCE          → atomic, gap-free, per (institution, type)
//
// Design guarantees (mirrors the task spec):
//   - Immutable: assigned once, never overwritten (assignManexaId is a no-op if
//     the user already has one). Name/designation/department changes do nothing.
//   - Never reused: the sequence counter only ever increments, so a deleted
//     DPS-S-001 is never handed out again (the next student still gets 003).
//   - Race-safe & transactional: built on the existing atomic SequenceCounter
//     (nextSequence) — never COUNT()+1. The User.manexaId UNIQUE index is the
//     final backstop against any duplicate.
//   - Multi-tenant isolated: the counter is keyed by tenantId, and the code is
//     the tenant's own — one institution can never collide with another.
//
// EVERY create path (manual admission, bulk import, staff join, owner signup)
// calls assignManexaId — there is no per-model ID logic anywhere else.
// ─────────────────────────────────────────────────────────────────────────

import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { nextSequence } from "./sequence";

type Db = PrismaClient | Prisma.TransactionClient;

export type PersonTypeCode =
  | "S" // Student
  | "T" // Teacher
  | "ADM" // Administrator
  | "MGT" // Management
  | "HR" // Human Resources
  | "FIN" // Finance
  | "IT" // Information Technology
  | "TRN" // Transport
  | "DRV" // Driver
  | "SEC" // Security
  | "LIB" // Library
  | "MED" // Medical
  | "SUP" // Support
  | "STF"; // General Staff

export const TYPE_LABELS: Record<PersonTypeCode, string> = {
  S: "Student",
  T: "Teacher",
  ADM: "Administrator",
  MGT: "Management",
  HR: "Human Resources",
  FIN: "Finance",
  IT: "Information Technology",
  TRN: "Transport",
  DRV: "Driver",
  SEC: "Security",
  LIB: "Library",
  MED: "Medical",
  SUP: "Support",
  STF: "General Staff",
};

// Exact role → type mapping (the strongest signal, checked first).
const ROLE_TYPE: Record<string, PersonTypeCode> = {
  STUDENT: "S",
  TEACHER: "T",
  INSTITUTION_ADMIN: "ADM",
  PRINCIPAL: "MGT",
  HR: "HR",
  ACCOUNTANT: "FIN",
  LIBRARIAN: "LIB",
  TRANSPORT_MGR: "TRN",
  STAFF: "STF",
};

/**
 * Resolve the coarse, IMMUTABLE type code for a person at creation time. Role is
 * authoritative; designation/department keywords refine a generic STAFF record
 * into DRV/SEC/IT/MED/etc. Decided ONCE — later edits never re-resolve it.
 */
export function resolvePersonType(input: {
  kind?: "STUDENT" | "STAFF";
  role?: string | null;
  designation?: string | null;
  department?: string | null;
}): PersonTypeCode {
  if (input.kind === "STUDENT" || input.role === "STUDENT") return "S";

  const role = (input.role ?? "").toUpperCase().trim();
  if (ROLE_TYPE[role] && role !== "STAFF") return ROLE_TYPE[role];

  // Keyword fallback for generic staff (or when only a designation is known).
  const text = `${role} ${input.designation ?? ""} ${input.department ?? ""}`.toUpperCase();
  if (/DRIV/.test(text)) return "DRV";
  if (/SECUR|GUARD|WATCH/.test(text)) return "SEC";
  if (/\bIT\b|INFORMATION TECH|SYSADMIN|NETWORK|SOFTWARE/.test(text)) return "IT";
  if (/LIBRAR/.test(text)) return "LIB";
  if (/MEDIC|NURSE|DOCTOR|INFIRMARY|HEALTH/.test(text)) return "MED";
  if (/TRANSPORT|FLEET|BUS/.test(text)) return "TRN";
  if (/FINANC|ACCOUNT|CASHIER|BURSAR/.test(text)) return "FIN";
  if (/\bHR\b|HUMAN RESOURCE|RECRUIT|PAYROLL/.test(text)) return "HR";
  if (/PRINCIPAL|MANAG|DIRECTOR|DEAN|VICE|HEAD OF/.test(text)) return "MGT";
  if (/ADMIN/.test(text)) return "ADM";
  if (/TEACH|FACULTY|LECTURER|PROFESSOR|TUTOR/.test(text)) return "T";
  if (/SUPPORT|HELP|ASSIST|CLERK|PEON|JANITOR|CLEAN/.test(text)) return "SUP";
  return "STF";
}

/**
 * Build the next MANEXA ID for (tenant, type) — atomic and gap-free. Pass a
 * transaction client so ID generation joins the caller's transaction (rule 11).
 */
export async function generateManexaId(tenantId: string, type: PersonTypeCode, db: Db = prisma): Promise<string> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { code: true } });
  if (!tenant?.code) throw new Error("Institution code not found for tenant " + tenantId);
  // Fresh per-(tenant,type) counter starts at 1; only ever increments.
  const seq = await nextSequence(tenantId, `manexa:${type}`, async () => 0, db);
  return `${tenant.code}-${type}-${String(seq).padStart(3, "0")}`;
}

/**
 * Assign a MANEXA ID to a user if they don't already have one. Idempotent and
 * immutable: an existing ID is returned untouched. Returns the (new or existing)
 * ID. Runs inside the caller's `db` (transaction) when provided.
 */
export async function assignManexaId(
  db: Db,
  input: {
    userId: string;
    tenantId: string;
    // Either give an explicit type, or the classifiers to resolve one.
    type?: PersonTypeCode;
    kind?: "STUDENT" | "STAFF";
    role?: string | null;
    designation?: string | null;
    department?: string | null;
  }
): Promise<string> {
  const existing = await db.user.findUnique({ where: { id: input.userId }, select: { manexaId: true } });
  if (existing?.manexaId) return existing.manexaId; // immutable — never overwrite

  const type = input.type ?? resolvePersonType(input);
  const manexaId = await generateManexaId(input.tenantId, type, db);
  await db.user.update({ where: { id: input.userId }, data: { manexaId } });
  return manexaId;
}
