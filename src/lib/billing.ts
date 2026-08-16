// ─────────────────────────────────────────────────────────────
// Billing / entitlements — the single source of truth for a tenant's plan,
// seat limits, feature entitlements, and subscription lifecycle status.
//
// Source of truth: the latest `Subscription` row (carries studentSeats +
// renewsAt + status). Tenants with no Subscription fall back to the trial
// fields denormalized on `Tenant` (planId / subscriptionExpiry) — that's the
// 14-day trial every self-serve institution gets on creation.
//
// This module is READ-ONLY (never mutates). The `assert*` helpers throw typed,
// user-facing errors (HTTP 402) that server actions surface as upgrade
// prompts. Enforcement fails OPEN when nothing is configured (trial / no plan),
// so existing tenants are never broken — it only bites once a paid plan with a
// real seat cap is attached, or once a subscription has lapsed past grace.
// ─────────────────────────────────────────────────────────────

import { prisma } from "./prisma";

/** Days after expiry during which writes are still allowed (loud warning). */
export const GRACE_DAYS = 7;

/** Generous defaults for trial tenants (no attached plan) so onboarding and
 *  product evaluation are never blocked by seat caps. */
export const TRIAL_LIMITS = { students: 50, staff: 20 } as const;

export type SubStatus = "TRIAL" | "ACTIVE" | "GRACE" | "EXPIRED";
export type SeatKind = "students" | "staff";

// ---- typed, surfaceable errors (402 Payment Required) ----

export class SubscriptionExpiredError extends Error {
  code = "SUBSCRIPTION_EXPIRED";
  status = 402;
  constructor(message = "Your subscription has expired. Renew your plan to continue adding records.") {
    super(message);
    this.name = "SubscriptionExpiredError";
  }
}

export class SeatLimitError extends Error {
  code = "SEAT_LIMIT";
  status = 402;
  constructor(
    public kind: SeatKind,
    public limit: number,
    public used: number,
    message?: string
  ) {
    super(
      message ??
        `${kind === "students" ? "Student" : "Staff"} seat limit reached (${used}/${limit}). Upgrade your plan to add more.`
    );
    this.name = "SeatLimitError";
  }
}

export class FeatureLockedError extends Error {
  code = "FEATURE_LOCKED";
  status = 402;
  constructor(
    public feature: string,
    message?: string
  ) {
    super(message ?? `“${feature}” is not included in your current plan. Upgrade to unlock it.`);
    this.name = "FeatureLockedError";
  }
}

/** True for any billing error thrown by this module — lets callers catch the
 *  whole family and surface it as an upgrade prompt. */
export function isBillingError(
  e: unknown
): e is SubscriptionExpiredError | SeatLimitError | FeatureLockedError {
  return (
    e instanceof SubscriptionExpiredError ||
    e instanceof SeatLimitError ||
    e instanceof FeatureLockedError
  );
}

export interface BillingState {
  tenantId: string;
  planCode: string | null;
  planName: string | null;
  status: SubStatus;
  /** Renewal (paid) or trial-end date. null only if a plan exists with no date. */
  expiresAt: Date | null;
  /** Whole days until expiry; negative once past. null if no date. */
  daysLeft: number | null;
  /** In the post-expiry grace window — writes allowed, but warn loudly. */
  inGrace: boolean;
  /** Writes permitted right now (TRIAL / ACTIVE / GRACE). */
  writable: boolean;
  /** null = unlimited. */
  limits: { students: number | null; staff: number | null };
  usage: { students: number; staff: number };
  /** Total BILLABLE members = active students + active staff (teachers are
   *  staff). Metered from live records, never a manually-entered count — this is
   *  what MANEXA charges the institution on. */
  billableMembers: number;
  /** Feature entitlements from the plan (empty for trial → treated as full). */
  features: Set<string>;
  /** False when the plan's features JSON was malformed → fail open. */
  featuresKnown: boolean;
  isTrial: boolean;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Resolve the full billing/entitlement state for a tenant. Single DB round-trip
 * of small counts; safe to call in server components and actions.
 */
export async function getBillingState(tenantId: string): Promise<BillingState> {
  const [tenant, sub, students, staff] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionExpiry: true, plan: { select: { code: true, name: true, features: true } } },
    }),
    // Latest subscription row wins (renewals create newer rows).
    prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        studentSeats: true,
        status: true,
        renewsAt: true,
        plan: { select: { code: true, name: true, features: true } },
      },
    }),
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    // Active staff only — resigned employees must not consume seats.
    prisma.staff.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);

  const plan = sub?.plan ?? tenant?.plan ?? null;
  const isTrial = !sub && !tenant?.plan; // no subscription and no attached plan
  const expiresAt = sub?.renewsAt ?? tenant?.subscriptionExpiry ?? null;

  // Feature set from the plan's JSON-encoded string[]. Empty for trials, which
  // we treat as full access (time-limited evaluation) in hasFeature below.
  const features = new Set<string>();
  let featuresKnown = false;
  if (plan?.features) {
    try {
      for (const f of JSON.parse(plan.features) as string[]) features.add(f);
      featuresKnown = true;
    } catch {
      // Malformed features JSON → treat entitlements as UNKNOWN and fail open
      // (an empty set here used to lock every gated feature instead).
      featuresKnown = false;
    }
  }

  const now = new Date();
  const daysLeft = expiresAt ? daysBetween(now, expiresAt) : null;

  // Lifecycle status.
  let status: SubStatus;
  let inGrace = false;
  if (!expiresAt) {
    // A plan with no date (rare) → treat as active; trial with no date → active-ish.
    status = isTrial ? "TRIAL" : "ACTIVE";
  } else if (expiresAt.getTime() >= now.getTime()) {
    status = isTrial ? "TRIAL" : "ACTIVE";
  } else {
    // Past expiry.
    const daysOver = -(daysLeft ?? 0);
    if (daysOver <= GRACE_DAYS) {
      status = "GRACE";
      inGrace = true;
    } else {
      status = "EXPIRED";
    }
  }
  // An explicitly cancelled/suspended subscription is never writable.
  if (sub && (sub.status === "CANCELLED" || sub.status === "SUSPENDED")) {
    status = "EXPIRED";
    inGrace = false;
  }

  const writable = status !== "EXPIRED";

  const limits = {
    students: isTrial ? TRIAL_LIMITS.students : (sub?.studentSeats ?? null),
    // No staff-seat column on the plan → unlimited on paid plans; capped on trial.
    staff: isTrial ? TRIAL_LIMITS.staff : null,
  };

  return {
    tenantId,
    planCode: plan?.code ?? null,
    planName: plan?.name ?? (isTrial ? "Trial" : null),
    status,
    expiresAt,
    daysLeft,
    inGrace,
    writable,
    limits,
    usage: { students, staff },
    billableMembers: students + staff,
    features,
    featuresKnown,
    isTrial,
  };
}

/**
 * MANEXA-billing usage snapshot for an institution, metered from live active
 * records (spec: never rely on manually-entered member counts). Configurable per
 * member type via `perMember` overrides if a plan prices staff and students
 * differently; defaults treat every billable member equally.
 */
export async function getBillableUsage(
  tenantId: string,
  perMember: { student?: number; staff?: number } = {}
): Promise<{ students: number; staff: number; billableMembers: number; amountPerCycle: number | null }> {
  const [students, staff] = await Promise.all([
    prisma.student.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.staff.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);
  const priceS = perMember.student;
  const priceT = perMember.staff ?? perMember.student;
  const amountPerCycle =
    priceS === undefined && priceT === undefined
      ? null
      : students * (priceS ?? 0) + staff * (priceT ?? 0);
  return { students, staff, billableMembers: students + staff, amountPerCycle };
}

/** Throw if the subscription has lapsed past its grace window. */
export async function assertActiveSubscription(tenantId: string): Promise<BillingState> {
  const state = await getBillingState(tenantId);
  if (!state.writable) throw new SubscriptionExpiredError();
  return state;
}

/**
 * Throw if adding `add` more records of `kind` would exceed the plan's seat cap.
 * Also enforces subscription validity first (can't grow an expired tenant).
 * No-op when the limit is null (unlimited).
 */
export async function assertSeat(
  tenantId: string,
  kind: SeatKind,
  add = 1
): Promise<BillingState> {
  const state = await assertActiveSubscription(tenantId);
  const limit = state.limits[kind];
  if (limit === null) return state; // unlimited
  const used = state.usage[kind];
  if (used + add > limit) throw new SeatLimitError(kind, limit, used);
  return state;
}

/** True if the tenant's plan includes `feature` (trials get full access). */
export async function hasFeature(tenantId: string, feature: string): Promise<boolean> {
  const state = await getBillingState(tenantId);
  if (state.isTrial) return true; // trial = full evaluation access
  if (!state.featuresKnown) return true; // malformed plan config → fail open
  return state.features.has(feature);
}

/** Throw FeatureLockedError unless the tenant's plan includes `feature`. */
export async function requireFeature(tenantId: string, feature: string): Promise<void> {
  if (!(await hasFeature(tenantId, feature))) throw new FeatureLockedError(feature);
}
