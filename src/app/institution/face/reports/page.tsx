import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat } from "@/components/ui";
import { DataTable } from "@/components/DataTable";

export default async function FaceReports({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const days = range === "week" ? 7 : range === "year" ? 365 : range === "month" ? 30 : 30;
  const from = new Date(Date.now() - days * 86400000);

  const records = await prisma.faceAttendanceRecord.findMany({
    where: { recognizedAt: { gte: from }, session: { tenantId } },
    include: { student: { include: { user: true, class: true, section: true } }, session: { include: { subject: true } } },
    orderBy: { recognizedAt: "desc" },
    take: 3000,
  });

  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const avgConf = records.length ? Math.round(records.reduce((s, r) => s + r.confidence, 0) / records.length) : 0;

  const rows = records.map((r) => ({
    date: r.recognizedAt.toISOString().slice(0, 10),
    time: r.recognizedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    admission: r.student.admissionNo,
    student: r.student.user.displayName,
    class: `${r.student.class.name} ${r.student.section.name}`,
    subject: r.session.subject?.name ?? "—",
    status: r.status,
    confidence: r.confidence,
  }));

  const ranges = [
    { k: "week", label: "7 days" },
    { k: "month", label: "30 days" },
    { k: "year", label: "1 year" },
  ];

  return (
    <>
      <PageHeader
        title="Attendance reports"
        sub="Face-marked attendance · export to CSV (PDF/Excel via the print view)"
      />
      <div className="flex gap-2 mb-4">
        {ranges.map((r) => (
          <a key={r.k} href={`/institution/face/reports?range=${r.k}`} className={`btn-secondary text-xs ${(range ?? "month") === r.k ? "border-accent text-accent" : ""}`}>
            {r.label}
          </a>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Marks" value={records.length} tone="accent" />
        <Stat label="Present" value={present} tone="success" />
        <Stat label="Late" value={late} tone={late ? "warning" : "default"} />
        <Stat label="Avg confidence" value={`${avgConf}%`} />
      </div>
      <SectionCard>
        <DataTable
          exportName={`face-attendance-${range ?? "month"}`}
          searchPlaceholder="Search student, class, subject…"
          columns={[
            { key: "date", label: "Date" },
            { key: "time", label: "Time" },
            { key: "admission", label: "Adm #" },
            { key: "student", label: "Student" },
            { key: "class", label: "Class" },
            { key: "subject", label: "Subject" },
            { key: "status", label: "Status" },
            { key: "confidence", label: "Conf %", numeric: true },
          ]}
          rows={rows}
        />
      </SectionCard>
    </>
  );
}
