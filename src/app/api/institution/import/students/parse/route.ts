// Parse an uploaded students file (.xlsx / .csv) → validated preview. Parsing
// happens server-side (no client bundle, and the file is validated before it
// can touch the DB). Returns the ready rows as JSON for the commit step.
import * as XLSX from "xlsx";
import { getCurrentUser, type Role } from "@/lib/auth";
import { mapHeaders, toStudentRow, validateRow, type StudentRow } from "@/lib/import/students";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["INSTITUTION_ADMIN", "PRINCIPAL"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(user.role as Role)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File too large (max 8MB)" }, { status: 413 });

  let records: Record<string, unknown>[];
  let headers: string[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return Response.json({ error: "The file has no sheets" }, { status: 422 });
    // raw:false → formatted text (keeps "2014-03-10" instead of an Excel serial).
    records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    headers = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] as string[] | undefined)?.map(String) ?? [];
  } catch {
    return Response.json({ error: "Could not read the file — is it a valid .xlsx or .csv?" }, { status: 422 });
  }

  if (records.length === 0) return Response.json({ error: "The file has no data rows" }, { status: 422 });
  if (records.length > 25000) return Response.json({ error: "Too many rows (max 25,000 per file)" }, { status: 413 });

  const headerMap = mapHeaders(headers);
  const mappedKeys = new Set(Object.values(headerMap));
  const unmapped = headers.filter((h) => !headerMap[h]);

  const ready: StudentRow[] = [];
  const invalid: { row: number; name: string; reasons: string }[] = [];
  const seenAdm = new Set<string>();

  records.forEach((raw, i) => {
    const row = toStudentRow(raw, headerMap);
    const errs = validateRow(row);
    if (row.admissionNo) {
      const k = row.admissionNo.toLowerCase();
      if (seenAdm.has(k)) errs.push("Duplicate admission number in file");
      else seenAdm.add(k);
    }
    if (errs.length) invalid.push({ row: i + 2, name: row.name || "—", reasons: errs.join("; ") });
    else ready.push(row);
  });

  return Response.json({
    fileName: file.name,
    total: records.length,
    ready,
    readyCount: ready.length,
    invalid,
    invalidCount: invalid.length,
    mappedColumns: Array.from(mappedKeys),
    unmappedColumns: unmapped,
  });
}
