import Link from "next/link";
import { getBillingState, GRACE_DAYS, type BillingState } from "@/lib/billing";

// Server component. Drop `<BillingBanner tenantId={tenantId} />` at the top of
// any institution page. Renders only when the tenant needs to see something:
// a trial/grace/expired notice, or a near-full seat warning. Silent when the
// subscription is healthy and seats have plenty of headroom.

const UPGRADE_HREF = "/institution/settings";

function pct(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

/** Highest-severity thing worth telling the tenant, or null to stay silent. */
function verdict(s: BillingState): { tone: "error" | "warning" | "info"; title: string; body: string } | null {
  if (s.status === "EXPIRED") {
    return {
      tone: "error",
      title: "Subscription expired",
      body: "Adding new students, staff and members is paused. Renew your plan to restore full access — your existing data is safe.",
    };
  }
  if (s.status === "GRACE") {
    const over = s.daysLeft === null ? 0 : -s.daysLeft;
    return {
      tone: "error",
      title: "Payment overdue — grace period",
      body: `Your plan expired ${over} day${over === 1 ? "" : "s"} ago. You have ${GRACE_DAYS - over} day${GRACE_DAYS - over === 1 ? "" : "s"} of grace left before new records are blocked. Renew now to avoid interruption.`,
    };
  }

  const studentPct = pct(s.usage.students, s.limits.students);
  const seatWarn = studentPct !== null && studentPct >= 90;

  if (s.status === "TRIAL") {
    // daysLeft null = trial with no end date recorded — don't scream "0 days".
    if (s.daysLeft === null) {
      return {
        tone: "info",
        title: "Free trial",
        body: "Pick a plan any time to lock in your data and unlock higher limits.",
      };
    }
    const d = s.daysLeft;
    return {
      tone: d <= 3 ? "warning" : "info",
      title: `Free trial · ${Math.max(0, d)} day${d === 1 ? "" : "s"} left`,
      body: seatWarn
        ? `You're using ${s.usage.students}/${s.limits.students} student seats. Choose a plan to keep growing after your trial.`
        : "You're on the 14-day trial. Pick a plan any time to lock in your data and unlock higher limits.",
    };
  }
  if (seatWarn) {
    return {
      tone: "warning",
      title: "Student seats almost full",
      body: `${s.usage.students} of ${s.limits.students} seats used. Upgrade your plan before you run out.`,
    };
  }
  return null; // healthy + roomy → say nothing
}

const TONE: Record<"error" | "warning" | "info", string> = {
  error: "bg-error/12 text-error border-error/30",
  warning: "bg-warning/12 text-warning border-warning/30",
  info: "bg-info/12 text-info border-info/30",
};

export async function BillingBanner({ tenantId }: { tenantId: string }) {
  const state = await getBillingState(tenantId);
  const v = verdict(state);
  if (!v) return null;

  const studentPct = pct(state.usage.students, state.limits.students);

  return (
    <div className={`card mb-6 border ${TONE[v.tone]}`} role="status">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="dot" aria-hidden />
            <span className="text-sm font-semibold text-fg">{v.title}</span>
            {state.planName && (
              <span className="badge text-xs">{state.planName}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{v.body}</p>
          {studentPct !== null && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-elevated">
                <div
                  className={`h-full rounded-full ${studentPct >= 90 ? "bg-error" : studentPct >= 75 ? "bg-warning" : "bg-accent"}`}
                  style={{ width: `${studentPct}%` }}
                />
              </div>
              <span>
                {state.usage.students}/{state.limits.students} student seats
              </span>
            </div>
          )}
        </div>
        <Link href={UPGRADE_HREF} className="btn-primary shrink-0 whitespace-nowrap">
          {state.status === "EXPIRED" || state.status === "GRACE" ? "Renew plan" : "Upgrade plan"}
        </Link>
      </div>
    </div>
  );
}
