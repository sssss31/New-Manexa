// ─────────────────────────────────────────────────────────────
// Reusable Tenant Guard — the sanctioned way to touch tenant data.
//
// Two tools:
//  1. ownedOrThrow(model, where, …) — the by-id mutation guard. Fetches a record
//     ONLY if the `where` (which MUST include tenant scoping) matches; otherwise
//     throws TENANT_FORBIDDEN. Use before every update/delete by id so a caller
//     can never mutate another tenant's row (prevents IDOR / broken access ctrl).
//  2. tenantDb(tenantId) — a Prisma $extends client that AUTO-INJECTS the tenant
//     filter on every read/updateMany/deleteMany/count/aggregate/groupBy and into
//     create data, for the models that carry a tenantId column. New feature code
//     should use this so a developer can't forget tenant scoping. Opt-in, so it
//     never rewrites the semantics of the existing hand-scoped queries.
// ─────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class TenantForbiddenError extends Error {
  code = "TENANT_FORBIDDEN";
  status = 403;
  constructor(message = "Record not found or access denied") {
    super(message);
    this.name = "TenantForbiddenError";
  }
}

/**
 * Fetch a record via `model.findFirst({ where })` and throw if it doesn't exist
 * for the given (tenant-scoped) `where`. Return type flows through so callers can
 * keep using includes/relations exactly as before.
 *
 *   const exam = await ownedOrThrow(prisma.exam, { id, tenantId }, { include });
 *   await prisma.exam.update({ where: { id: exam.id }, data });   // now safe
 */
export async function ownedOrThrow<T = unknown>(
  // Accepts any Prisma model delegate (their findFirst signature is generic).
  model: { findFirst: (args: any) => Promise<unknown> },
  where: Record<string, unknown>,
  extra?: { include?: unknown; select?: unknown }
): Promise<T> {
  const rec = await model.findFirst({ where, ...(extra ?? {}) });
  if (rec === null || rec === undefined) throw new TenantForbiddenError();
  return rec as T;
}

// Models that carry a direct `tenantId` column (source: prisma schema scan).
// `User` is intentionally excluded — auth resolves users by email/token globally
// and platform admins have no tenant.
export const TENANT_MODELS = new Set<string>([
  "LoginEvent", "RolePermission", "Lead", "Class", "Section", "Subject", "Student",
  "Parent", "Staff", "TimetableEntry", "Attendance", "Course", "Exam", "FeeStructure",
  "Invoice", "PayrollRun", "Notice", "Message", "Vehicle", "Route", "LibraryItem",
  "DisciplineIncident", "Automation", "AuditLog", "Notification", "Event",
  "HostelRoom", "InventoryItem", "FaceProfile", "AttendanceDevice",
  "FaceAttendanceSession", "RecognitionLog", "UnknownFace",
]);

/**
 * A tenant-scoped Prisma client. Every query on a TENANT_MODEL is auto-filtered
 * by `tenantId`; creates auto-stamp it. Reads/writes to other models pass through.
 * Use in new feature code:  const db = tenantDb(user.tenantId); await db.student.findMany();
 */
export function tenantDb(tenantId: string) {
  return prisma.$extends({
    name: "tenant-guard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = (args ?? {}) as Record<string, unknown>;

          if (
            operation === "findMany" || operation === "findFirst" || operation === "count" ||
            operation === "aggregate" || operation === "groupBy" || operation === "updateMany" ||
            operation === "deleteMany" || operation === "findFirstOrThrow"
          ) {
            a.where = { ...(a.where as object), tenantId };
          } else if (operation === "create") {
            a.data = { tenantId, ...(a.data as object) };
          } else if (operation === "createMany") {
            const data = a.data as Record<string, unknown> | Record<string, unknown>[];
            a.data = Array.isArray(data)
              ? data.map((d) => ({ tenantId, ...d }))
              : { tenantId, ...data };
          }
          // findUnique/update/delete use a unique arg and can't take extra where
          // filters — always guard those with ownedOrThrow() instead.
          return query(a);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof tenantDb>;

// Re-export Prisma namespace for typed where clauses at call sites.
export { Prisma };
