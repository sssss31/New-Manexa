import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat } from "@/components/ui";
import { inr } from "@/lib/format";

export default async function ReportsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [classes, students, marks, invoicesAll, paidAgg, dueAgg, notices] = await Promise.all([
    prisma.class.findMany({
      where: { tenantId },
      include: { _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.student.count({ where: { tenantId } }),
    prisma.mark.findMany({ where: { exam: { tenantId } } }),
    prisma.invoice.count({ where: { tenantId } }),
    prisma.payment.aggregate({ where: { invoice: { tenantId } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({
      where: { tenantId, status: { in: ["DUE", "OVERDUE"] } },
      _sum: { total: true },
    }),
    prisma.notice.count({ where: { tenantId } }),
  ]);
  const avgScore = marks.length ? Math.round(marks.reduce((s, m) => s + m.score, 0) / marks.length) : 0;
  return (
    <>
      <PageHeader title="Reports · Principal Cockpit" sub="Institutional MIS at a glance" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total students" value={students.toLocaleString()} tone="accent" />
        <Stat label="Avg exam score" value={`${avgScore} / 100`} />
        <Stat label="Collected" value={inr(paidAgg._sum.amount ?? 0)} tone="success" />
        <Stat label="Outstanding" value={inr(dueAgg._sum.total ?? 0)} tone="error" />
      </div>

      <SectionCard title="Class-wise enrolment">
        <table className="w-full">
          <thead><tr><th className="th">Class</th><th className="th">Students</th><th className="th">Share</th></tr></thead>
          <tbody>
            {classes.map((c) => {
              const share = students ? Math.round((c._count.students / students) * 100) : 0;
              return (
                <tr key={c.id} className="row-hover">
                  <td className="td">{c.name}</td>
                  <td className="td tabular-nums">{c._count.students}</td>
                  <td className="td">
                    <div className="w-40 h-2 rounded bg-elevated overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${share}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <Stat label="Invoices raised" value={invoicesAll.toLocaleString()} />
        <Stat label="Notices published" value={notices} />
        <Stat label="Region" value="ap-south-1 · Mumbai" />
      </div>
    </>
  );
}
