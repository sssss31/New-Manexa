import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { TASK_PRIORITIES } from "@/lib/ops";
import { createTaskAction, setTaskStatusAction, deleteTaskAction } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
] as const;

const PRIORITY_TONE: Record<string, "error" | "warning" | "muted"> = { HIGH: "error", MEDIUM: "warning", LOW: "muted" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const sp = await searchParams;

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({ where: { tenantId }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 200 }),
    prisma.user.findMany({ where: { tenantId, status: "ACTIVE" }, select: { id: true, displayName: true, role: true }, orderBy: { displayName: "asc" } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.displayName]));
  const byStatus = (s: string) => tasks.filter((t) => t.status === s);

  return (
    <>
      <PageHeader title="Tasks" sub="Team task board across the institution" />
      {sp.err && <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error" role="alert">{decodeURIComponent(sp.err)}</div>}

      {/* New task */}
      <SectionCard className="mb-6">
        <div className="text-sm font-semibold text-fg mb-3">New task</div>
        <form action={createTaskAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="lg:col-span-2"><span className="label">Title</span><input name="title" required placeholder="e.g. Finalise exam datesheet" className="input" /></label>
          <label><span className="label">Assignee</span>
            <select name="assigneeId" className="select" defaultValue="">
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} · {u.role.replace(/_/g, " ").toLowerCase()}</option>)}
            </select>
          </label>
          <label><span className="label">Priority</span>
            <select name="priority" className="select" defaultValue="MEDIUM">{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}</select>
          </label>
          <label><span className="label">Due</span><input name="dueDate" type="date" className="input" /></label>
          <label className="lg:col-span-4"><span className="label">Description</span><input name="description" placeholder="Optional details" className="input" /></label>
          <div className="lg:col-span-1 flex items-end"><button className="btn-primary w-full">Add task</button></div>
        </form>
      </SectionCard>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = byStatus(col.key);
          return (
            <div key={col.key} className="rounded-2xl border border-border bg-surface/40 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-semibold text-fg">{col.label}</span>
                <span className="badge badge-muted">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <div className="text-xs text-subtle px-1 py-6 text-center">Nothing here.</div>}
                {items.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-fg font-medium">{t.title}</span>
                      <Tag tone={PRIORITY_TONE[t.priority] ?? "muted"}>{t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}</Tag>
                    </div>
                    {t.description && <p className="text-xs text-muted mt-1">{t.description}</p>}
                    <div className="text-[11px] text-subtle mt-2 flex flex-wrap items-center gap-x-2">
                      <span>{t.assigneeId ? (nameOf.get(t.assigneeId) ?? "Assigned") : "Unassigned"}</span>
                      {t.dueDate && <span>· due {dateShort(t.dueDate)}</span>}
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      {col.key !== "TODO" && <MoveBtn id={t.id} to={col.key === "DONE" ? "IN_PROGRESS" : "TODO"} label="←" />}
                      {col.key !== "DONE" && <MoveBtn id={t.id} to={col.key === "TODO" ? "IN_PROGRESS" : "DONE"} label={col.key === "TODO" ? "Start →" : "Done →"} primary />}
                      <form action={deleteTaskAction} className="ml-auto">
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn-ghost text-xs text-error hover:bg-error/10 px-2" aria-label="Delete task">✕</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MoveBtn({ id, to, label, primary }: { id: string; to: string; label: string; primary?: boolean }) {
  return (
    <form action={setTaskStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={to} />
      <button className={`${primary ? "btn-secondary" : "btn-ghost"} text-xs px-2`}>{label}</button>
    </form>
  );
}
