// Downloadable CSV template with the documented columns + one sample row.
import { getCurrentUser } from "@/lib/auth";
import { STUDENT_TEMPLATE_HEADERS, STUDENT_TEMPLATE_SAMPLE } from "@/lib/import/students";

export const runtime = "nodejs";

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const csv = [STUDENT_TEMPLATE_HEADERS, STUDENT_TEMPLATE_SAMPLE].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="manexa-students-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
