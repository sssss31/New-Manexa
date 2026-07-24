import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, roleHome } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Tag } from "@/components/ui";
import { relative } from "@/lib/format";
import { markAllReadAction } from "./actions";

const KIND_LABEL: Record<string, string> = {
  attendance: "Attendance",
  fee: "Fees",
  exam: "Exams",
  notice: "Notice",
  event: "Event",
  system: "System",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({
    where: {
      tenantId: user.tenantId ?? undefined,
      OR: [
        { userId: user.id },
        { userId: null, role: user.role },
        { userId: null, role: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Link href={roleHome(user.role)} className="btn-secondary text-xs">← Back to portal</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8 animate-fade-up">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-fg">Notifications</h1>
            <p className="text-sm text-muted mt-1">Targeted alerts + broadcasts for your role</p>
          </div>
          <form action={markAllReadAction}>
            <button className="btn-primary text-xs">Mark all read</button>
          </form>
        </div>

        {items.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">Nothing here yet — alerts land as events fire.</div>
        )}
        <ul className="space-y-2">
          {items.map((n) => {
            const unread = n.userId === user.id && !n.readAt;
            return (
              <li key={n.id} className={`card p-4 ${unread ? "border-accent/40" : ""}`}>
                <div className="flex items-start gap-3">
                  {unread && <span className="dot mt-2 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-fg">{n.title}</span>
                      <span className="text-xs text-subtle whitespace-nowrap">{relative(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted mt-0.5">{n.body}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Tag>{KIND_LABEL[n.kind] ?? n.kind}</Tag>
                      {!n.userId && <Tag tone="muted">Broadcast</Tag>}
                      {n.href && <Link href={n.href} className="text-xs text-accent hover:underline">Open →</Link>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
