import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, Stat, Tag } from "@/components/ui";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { relative } from "@/lib/format";
import { advanceLeadAction, admitLeadAction, createLeadAction } from "../actions";

const STAGES = ["NEW", "CONTACTED", "VISIT_SCHEDULED", "VISITED", "APPLICATION", "CONFIRMED", "LOST"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ err?: string }>;
}) {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const err = (await searchParams)?.err;
  const [leads, classes, sections] = await Promise.all([
    prisma.lead.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.class.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.section.findMany({ where: { tenantId }, include: { class: true } }),
  ]);

  const byStage = STAGES.map((s) => ({ s, n: leads.filter((l) => l.stage === s).length }));

  return (
    <>
      <PageHeader
        title="LEAD & Admissions CRM"
        sub="Capture from any channel, nurture through stages, convert to enrolment"
      />
      <BillingBanner tenantId={tenantId} />
      {err && (
        <div className="card mb-6 border border-error/30 bg-error/12 p-4 text-sm text-error" role="alert">
          {err}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-6">
        {byStage.map((b) => (
          <Stat key={b.s} label={b.s.replace(/_/g, " ")} value={b.n} tone={b.s === "CONFIRMED" ? "success" : b.s === "LOST" ? "error" : "default"} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Pipeline" className="lg:col-span-2">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="th">Prospect</th>
                  <th className="th">Grade</th>
                  <th className="th">Source</th>
                  <th className="th">Score</th>
                  <th className="th">Stage</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="row-hover align-top">
                    <td className="td">
                      <div className="font-medium text-fg">{l.studentName}</div>
                      <div className="text-xs text-muted">{l.parentName} · {l.phone}</div>
                      <div className="text-xs text-muted">{relative(l.createdAt)}</div>
                    </td>
                    <td className="td">{l.gradeInterest}</td>
                    <td className="td"><Tag>{l.source}</Tag></td>
                    <td className="td tabular-nums">{l.score}</td>
                    <td className="td"><StatusBadge status={l.stage} /></td>
                    <td className="td">
                      {l.stage !== "CONFIRMED" && l.stage !== "LOST" && (
                        <div className="flex flex-col gap-1.5">
                          <form action={advanceLeadAction} className="flex gap-1">
                            <input type="hidden" name="leadId" value={l.id} />
                            <select name="toStage" className="select text-xs px-2 py-1" defaultValue={nextStage(l.stage)}>
                              {STAGES.filter((s) => s !== l.stage).map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                              ))}
                            </select>
                            <button className="btn-secondary text-xs px-2 py-1">Move</button>
                          </form>
                          {(l.stage === "APPLICATION" || l.stage === "VISITED") && (
                            <form action={admitLeadAction} className="flex gap-1">
                              <input type="hidden" name="leadId" value={l.id} />
                              <select name="classId" className="select text-xs px-2 py-1" required>
                                <option value="">Class…</option>
                                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <select name="sectionId" className="select text-xs px-2 py-1" required>
                                <option value="">Section…</option>
                                {sections.map((s) => <option key={s.id} value={s.id}>{s.class.name} {s.name}</option>)}
                              </select>
                              <button className="btn-primary text-xs px-2 py-1">Admit</button>
                            </form>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Capture new lead">
          <form action={createLeadAction} className="space-y-3">
            <div><label className="label">Parent name</label><input className="input" name="parentName" required /></div>
            <div><label className="label">Student name</label><input className="input" name="studentName" required /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Grade</label>
                <select className="select" name="gradeInterest">
                  {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label">Source</label>
                <select className="select" name="source">
                  <option>WEBSITE</option><option>WALKIN</option><option>REFERRAL</option><option>ADS</option><option>WHATSAPP</option>
                </select>
              </div>
            </div>
            <div><label className="label">Phone</label><input className="input" name="phone" required /></div>
            <div><label className="label">Email (optional)</label><input className="input" name="email" type="email" /></div>
            <button className="btn-primary w-full">Add lead</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}

function nextStage(current: string) {
  const idx = STAGES.indexOf(current);
  return STAGES[Math.min(STAGES.length - 2, idx + 1)];
}
