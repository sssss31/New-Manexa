// DB-driven RBAC. Permissions live in the `Permission` catalog; grants live in
// `RolePermission` per tenant. `can()` is the runtime check — no hardcoded
// role→permission logic in feature code. requireRole() stays the coarse gate;
// can() is the granular one.

import { prisma } from "./prisma";

export const PERMISSIONS: { key: string; label: string; category: string }[] = [
  // People
  { key: "student.read", label: "View students", category: "People" },
  { key: "student.write", label: "Manage students", category: "People" },
  { key: "staff.read", label: "View staff", category: "People" },
  { key: "staff.write", label: "Manage staff", category: "People" },
  // Academics
  { key: "class.manage", label: "Manage classes & sections", category: "Academics" },
  { key: "timetable.manage", label: "Manage timetable", category: "Academics" },
  { key: "exam.manage", label: "Manage exams", category: "Academics" },
  { key: "result.publish", label: "Publish results", category: "Academics" },
  { key: "lms.manage", label: "Manage courses & lessons", category: "Academics" },
  { key: "homework.manage", label: "Manage homework", category: "Academics" },
  { key: "attendance.mark", label: "Mark attendance", category: "Academics" },
  { key: "attendance.read", label: "View attendance", category: "Academics" },
  { key: "face.enroll", label: "Enrol faces", category: "Academics" },
  { key: "face.recognize", label: "Run face attendance", category: "Academics" },
  // Finance
  { key: "fee.read", label: "View fees", category: "Finance" },
  { key: "fee.manage", label: "Manage fees & invoices", category: "Finance" },
  { key: "payroll.manage", label: "Manage payroll", category: "Finance" },
  // Operations
  { key: "transport.manage", label: "Manage transport", category: "Operations" },
  { key: "hostel.manage", label: "Manage hostel", category: "Operations" },
  { key: "library.manage", label: "Manage library", category: "Operations" },
  { key: "inventory.manage", label: "Manage inventory", category: "Operations" },
  { key: "notice.post", label: "Post notices", category: "Operations" },
  { key: "event.manage", label: "Manage events", category: "Operations" },
  // Platform (institution-level admin)
  { key: "ai.read", label: "View AI insights", category: "Platform" },
  { key: "audit.read", label: "View audit log", category: "Platform" },
  { key: "roles.manage", label: "Manage roles & permissions", category: "Platform" },
  { key: "settings.manage", label: "Manage settings", category: "Platform" },
];

const ALL = PERMISSIONS.map((p) => p.key);

// Default grants applied when an institution is provisioned. Editable per tenant
// afterwards via the Roles page (writes RolePermission rows).
export const DEFAULT_MATRIX: Record<string, string[]> = {
  INSTITUTION_ADMIN: ALL,
  PRINCIPAL: ALL.filter((k) => k !== "roles.manage"),
  TEACHER: [
    "student.read", "attendance.mark", "attendance.read", "exam.manage",
    "result.publish", "lms.manage", "homework.manage", "face.enroll",
    "face.recognize", "notice.post", "ai.read",
  ],
  ACCOUNTANT: ["student.read", "fee.read", "fee.manage", "payroll.manage"],
  LIBRARIAN: ["student.read", "library.manage"],
  TRANSPORT_MGR: ["student.read", "transport.manage"],
  HR: ["staff.read", "staff.write", "payroll.manage"],
  PARENT: [],
  STUDENT: [],
};

// Small per-process cache: tenantId:role -> Set(allowed keys). Cleared on edit.
const cache = new Map<string, Set<string>>();
export function invalidatePermissionCache(tenantId?: string) {
  if (!tenantId) return cache.clear();
  for (const k of cache.keys()) if (k.startsWith(`${tenantId}:`)) cache.delete(k);
}

async function grantsFor(tenantId: string, role: string): Promise<Set<string>> {
  const ck = `${tenantId}:${role}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const rows = await prisma.rolePermission.findMany({
    where: { tenantId, role, allowed: true },
    select: { permissionKey: true },
  });
  // Fall back to the default matrix if this tenant was never seeded (defensive).
  const set = rows.length
    ? new Set(rows.map((r) => r.permissionKey))
    : new Set(DEFAULT_MATRIX[role] ?? []);
  cache.set(ck, set);
  return set;
}

export async function can(
  user: { role: string; tenantId: string | null },
  permission: string
): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true; // platform operator
  if (!user.tenantId) return false;
  return (await grantsFor(user.tenantId, user.role)).has(permission);
}

// Seed the catalog once (idempotent) + per-tenant grants from the matrix.
export async function ensurePermissionCatalog() {
  await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({ where: { key: p.key }, update: { label: p.label, category: p.category }, create: p })
    )
  );
}

export async function seedTenantPermissions(tenantId: string) {
  const rows = Object.entries(DEFAULT_MATRIX).flatMap(([role, keys]) =>
    keys.map((permissionKey) => ({ tenantId, role, permissionKey, allowed: true }))
  );
  if (rows.length) {
    await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }
  invalidatePermissionCache(tenantId);
}
