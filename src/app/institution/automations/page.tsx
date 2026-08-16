import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge, Tag } from "@/components/ui";
import { relative } from "@/lib/format";
import { createAutomationAction, toggleAutomationAction } from "../actions";

const EVENTS = [
  { v: "attendance.absent", l: "Student marked absent" },
  { v: "fee.invoice.overdue", l: "Fee invoice overdue" },
  { v: "fee.invoice.paid", l: "Fee invoice paid" },
  { v: "exam.result.published", l: "Exam result published" },
  { v: "lead.new", l: "New lead captured" },
  { v: "assignment.missed", l: "Assignment missed" },
];

const ACTIONS = [
  { v: "SEND_SMS", l: "Send SMS" },
  { v: "SEND_WHATSAPP", l: "Send WhatsApp" },
  { v: "SEND_EMAIL", l: "Send Email" },
  { v: "CREATE_TASK", l: "Create task" },
];

export default async function AutomationsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const autos = await prisma.automation.findMany({
    where: { tenantId: user.tenantId! },
    orderBy: { createdAt: "desc" },
  });
  const recent = await prisma.automationRun.findMany({
    where: { automationId: { in: autos.map((a) => a.id) } },
    orderBy: { ranAt: "desc" },
    take: 12,
  });
  return (
    <>
      <PageHeader title="Automation engine" sub="No-code triggers → conditions → actions. Every event on the bus." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Rules" className="lg:col-span-2">
          <div className="space-y-2">
            {autos.map((a) => (
              <div key={a.id} className="flex items-baseline justify-between border border-border rounded-lg p-3">
                <div>
                  <div className="text-fg font-medium">{a.name}</div>
                  <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                    <Tag>{a.eventType ?? "—"}</Tag>
                    → <Tag tone="accent">{a.action}</Tag>
                    · {a.runsCount} runs
                    {a.lastRunAt && <> · last {relative(a.lastRunAt)}</>}
                  </div>
                </div>
                <form action={toggleAutomationAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="btn-secondary text-xs">{a.enabled ? "Disable" : "Enable"}</button>
                </form>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="New automation">
          <form action={createAutomationAction} className="space-y-3">
            <div><label className="label">Name</label><input className="input" name="name" placeholder="Absent → parent SMS" required /></div>
            <div><label className="label">Trigger event</label>
              <select className="select" name="eventType">
                {EVENTS.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
              </select>
            </div>
            <div><label className="label">Action</label>
              <select className="select" name="action">
                {ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
              </select>
            </div>
            <div><label className="label">Condition (note)</label><input className="input" name="condition" placeholder="e.g. amount > ₹500" /></div>
            <button className="btn-primary w-full">Create rule</button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Recent automation runs" className="mt-4">
        {recent.length === 0 && <div className="text-sm text-muted">No runs yet — trigger by marking a student absent or paying an invoice.</div>}
        <ul className="space-y-2">
          {recent.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between border-b border-border pb-1.5 last:border-0">
              <div className="text-sm text-fg">{r.detail}</div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <div className="text-xs text-muted">{relative(r.ranAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
