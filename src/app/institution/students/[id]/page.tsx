import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { KV, PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { dateShort, inr, relative } from "@/lib/format";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const student = await prisma.student.findFirst({
    where: { id, tenantId: user.tenantId! },
    include: {
      user: true,
      class: true,
      section: true,
      parents: { include: { parent: { include: { user: true } } } },
      invoices: { orderBy: { issueDate: "desc" }, take: 6 },
      attendance: { orderBy: { date: "desc" }, take: 10 },
      transportAlloc: { include: { route: true } },
      marks: { include: { exam: { include: { subject: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!student) notFound();
  const attRatio = student.attendance.length
    ? Math.round((student.attendance.filter((a) => a.status === "PRESENT").length / student.attendance.length) * 100)
    : 100;

  return (
    <>
      <PageHeader
        title={student.user.displayName}
        sub={`Admission #${student.admissionNo} · ${student.class.name} ${student.section.name} · Roll ${student.rollNo}`}
        actions={<StatusBadge status={student.status} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Profile">
          <KV k="Admission #" v={student.admissionNo} />
          <KV k="Class · section" v={`${student.class.name} · ${student.section.name}`} />
          <KV k="Roll" v={student.rollNo ?? "—"} />
          <KV k="DOB" v={student.dateOfBirth ? dateShort(student.dateOfBirth) : "—"} />
          <KV k="Gender" v={student.gender ?? "—"} />
          <KV k="Blood group" v={student.bloodGroup ?? "—"} />
          <KV k="Category" v={student.category ?? "—"} />
        </SectionCard>

        <SectionCard title="Parents / Guardians">
          {student.parents.length === 0 && <div className="text-sm text-muted">No parent linked.</div>}
          {student.parents.map((ps) => (
            <div key={ps.id} className="border border-border rounded-lg p-3 mb-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-fg font-medium">{ps.parent.user.displayName}</div>
                  <div className="text-xs text-muted">{ps.parent.relation} · {ps.parent.user.phone ?? "—"}</div>
                </div>
                {ps.isPrimary && <Tag tone="accent">Primary</Tag>}
              </div>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Snapshot">
          <KV k="Attendance %" v={`${attRatio}% (last ${student.attendance.length})`} />
          <KV k="Open invoices" v={student.invoices.filter((i) => i.status !== "PAID").length} />
          <KV k="Transport" v={student.transportAlloc ? `${student.transportAlloc.route.name} — ${student.transportAlloc.stopName}` : "Not opted"} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <SectionCard title="Recent attendance">
          <table className="w-full">
            <thead>
              <tr><th className="th">Date</th><th className="th">Status</th><th className="th">Reason</th></tr>
            </thead>
            <tbody>
              {student.attendance.map((a) => (
                <tr key={a.id} className="row-hover">
                  <td className="td text-muted">{dateShort(a.date)}</td>
                  <td className="td"><StatusBadge status={a.status} /></td>
                  <td className="td text-muted">{a.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Recent invoices">
          <table className="w-full">
            <thead>
              <tr><th className="th">#</th><th className="th">Period</th><th className="th">Amount</th><th className="th">Status</th></tr>
            </thead>
            <tbody>
              {student.invoices.map((i) => (
                <tr key={i.id} className="row-hover">
                  <td className="td font-mono text-xs">{i.number}</td>
                  <td className="td">{i.periodLabel}</td>
                  <td className="td tabular-nums">{inr(i.total)}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <SectionCard title="Recent marks" className="mt-4">
        {student.marks.length === 0 && <div className="text-sm text-muted">No marks recorded yet.</div>}
        <table className="w-full">
          <thead>
            <tr><th className="th">Exam</th><th className="th">Subject</th><th className="th">Score</th><th className="th">When</th></tr>
          </thead>
          <tbody>
            {student.marks.map((m) => (
              <tr key={m.id} className="row-hover">
                <td className="td">{m.exam.title}</td>
                <td className="td">{m.exam.subject.name}</td>
                <td className="td tabular-nums">{m.score} / 100</td>
                <td className="td text-xs text-muted">{relative(m.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
