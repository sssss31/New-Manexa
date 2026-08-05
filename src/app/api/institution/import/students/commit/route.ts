// Commit validated student rows. Guarded, tenant-scoped, per-row resilient.
import { getCurrentUser, type Role } from "@/lib/auth";
import { commitStudents, validateRow, type StudentRow } from "@/lib/import/students";
import { isBillingError } from "@/lib/billing";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["INSTITUTION_ADMIN", "PRINCIPAL"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(user.role as Role)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const rows: StudentRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return Response.json({ error: "No rows to import" }, { status: 400 });
  if (rows.length > 25000) return Response.json({ error: "Too many rows (max 25,000)" }, { status: 413 });
  // Re-validate server-side — never trust the client's "ready" flag.
  if (rows.some((r) => validateRow(r).length > 0)) {
    return Response.json({ error: "Some rows are invalid — re-upload and review the preview" }, { status: 422 });
  }

  try {
    const result = await commitStudents(user.tenantId, user.id, rows);
    return Response.json(result);
  } catch (e) {
    if (isBillingError(e)) return Response.json({ error: (e as Error).message }, { status: 402 });
    return Response.json({ error: "Import failed — please try again" }, { status: 500 });
  }
}
