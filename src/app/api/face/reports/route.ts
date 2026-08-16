import { guard, json } from "@/lib/face/api-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/face/reports?from=ISO&to=ISO&classId=...  — attendance rows for export
export async function GET(req: Request) {
  const g = await guard(req, { roles: ["INSTITUTION_ADMIN", "PRINCIPAL", "TEACHER"], bucket: "reports", limit: 120 });
  if ("res" in g) return g.res;
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(Date.now() - 30 * 86400000);
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const classId = sp.get("classId") ?? undefined;

  const records = await prisma.faceAttendanceRecord.findMany({
    where: {
      recognizedAt: { gte: from, lte: to },
      session: { tenantId: g.ctx.tenantId, ...(classId ? { classId } : {}) },
    },
    include: {
      student: { include: { user: true, class: true, section: true } },
      session: { include: { subject: true } },
    },
    orderBy: { recognizedAt: "desc" },
    take: 5000,
  });

  const rows = records.map((r) => ({
    date: r.recognizedAt.toISOString().slice(0, 10),
    time: r.recognizedAt.toISOString().slice(11, 19),
    admissionNo: r.student.admissionNo,
    student: r.student.user.displayName,
    class: `${r.student.class.name} ${r.student.section.name}`,
    subject: r.session.subject?.name ?? "—",
    status: r.status,
    confidence: r.confidence,
  }));
  return json({ from: from.toISOString(), to: to.toISOString(), count: rows.length, rows });
}
