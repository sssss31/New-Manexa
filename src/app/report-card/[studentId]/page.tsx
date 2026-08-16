import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, roleHome, type Role } from "@/lib/auth";
import { studentReportCard } from "@/lib/grading";
import { loadParentChildren } from "@/lib/parent-data";
import { Logo } from "@/components/Logo";
import { PrintButton } from "@/components/payments/PrintButton";

export const dynamic = "force-dynamic";

// Staff roles that may view any report card within their own tenant.
const STAFF: Role[] = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "PRINCIPAL", "TEACHER"];

function gradeClass(tone: string) {
  return tone === "success" ? "text-success" : tone === "accent" ? "text-accent" : tone === "warning" ? "text-warning" : "text-error";
}

export default async function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const user = await requireUser();
  const report = await studentReportCard(studentId);
  if (!report) notFound();

  // ── Authorization ─────────────────────────────────────────────────────────
  const s = report.student;
  let allowed = false;
  if (STAFF.includes(user.role as Role) && s.tenantId === user.tenantId) allowed = true;
  else if (user.role === "STUDENT" && s.userId === user.id) allowed = true;
  else if (user.role === "PARENT") {
    const kids = await loadParentChildren(user.id);
    allowed = kids.some((k: { id: string }) => k.id === s.id);
  }
  if (!allowed) notFound(); // don't reveal existence to unauthorized users

  const { overall } = report;

  return (
    <div className="min-h-screen bg-bg relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden print:hidden" aria-hidden>
        <div className="dash-orb dash-orb-green w-[520px] h-[520px] -top-48 -left-40" />
        <div className="dash-orb dash-orb-dim w-[460px] h-[460px] top-1/3 right-[-160px]" />
      </div>

      <header className="relative z-10 border-b border-border bg-surface/70 backdrop-blur-xl print:hidden">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <PrintButton />
            <Link href={roleHome(user.role)} className="btn-secondary text-xs">← Back</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-8 animate-fade-up">
        <div className="card p-6 md:p-8 print:border-0 print:shadow-none">
          {/* Report header */}
          <div className="flex items-start justify-between gap-4 border-b border-border pb-5 mb-5">
            <div>
              <div className="text-lg font-semibold text-fg">{s.tenantName}</div>
              <div className="text-xs text-subtle font-mono">{s.institutionId}</div>
              <div className="mt-2 text-sm font-medium text-accent">Report Card</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-fg font-semibold">{s.name}</div>
              <div className="text-muted">{s.className}</div>
              <div className="text-xs text-subtle">
                Adm. {s.admissionNo}
                {s.rollNo ? ` · Roll ${s.rollNo}` : ""}
              </div>
            </div>
          </div>

          {!report.hasData ? (
            <div className="py-12 text-center text-sm text-muted">
              No published results yet. This report card fills in automatically as exam results are published.
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <SummaryTile label="Overall" value={`${overall.pct}%`} sub={`${overall.obtained}/${overall.max}`} />
                <SummaryTile label="Grade" value={overall.grade.grade} valueClass={gradeClass(overall.grade.tone)} sub={overall.grade.pass ? "Pass" : "Needs improvement"} />
                <SummaryTile label="GPA" value={overall.gpa.toFixed(2)} sub="/ 10" />
                <SummaryTile label="Class rank" value={report.rank ? `${report.rank}` : "—"} sub={report.classSize ? `of ${report.classSize}` : ""} />
              </div>

              {/* Subject table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-subtle border-b border-border">
                      <th className="py-2 pr-3 font-medium">Subject</th>
                      <th className="py-2 px-3 font-medium text-right">Marks</th>
                      <th className="py-2 px-3 font-medium text-right">%</th>
                      <th className="py-2 pl-3 font-medium text-right">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.subjects.map((sub) => (
                      <tr key={sub.subjectId} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3">
                          <span className="text-fg">{sub.name}</span>
                          <span className="text-xs text-subtle font-mono"> · {sub.code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-fg">{sub.obtained}<span className="text-subtle">/{sub.max}</span></td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted">{sub.pct}%</td>
                        <td className={`py-2.5 pl-3 text-right font-semibold ${gradeClass(sub.grade.tone)}`}>{sub.grade.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="py-2.5 pr-3 text-fg">Total</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-fg">{overall.obtained}<span className="text-subtle">/{overall.max}</span></td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-fg">{overall.pct}%</td>
                      <td className={`py-2.5 pl-3 text-right ${gradeClass(overall.grade.tone)}`}>{overall.grade.grade}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="mt-6 text-[11px] text-subtle">
                Computed live from published exam results · grades on a 33% pass, A+ (91+) to F scale · rank within {s.className}.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryTile({ label, value, sub, valueClass = "text-fg" }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3">
      <div className="text-[11px] uppercase tracking-wider text-subtle">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-subtle mt-0.5">{sub}</div>}
    </div>
  );
}
