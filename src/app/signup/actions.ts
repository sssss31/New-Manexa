"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import { createSession, roleHome, validatePassword } from "@/lib/auth";
import { createInstitution, joinInstitution } from "@/lib/tenancy";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logger, isNextControlFlowError, isDbConnectionError } from "@/lib/logger";

// Error codes whose messages were written for end users (set by lib/tenancy).
// Everything else (Prisma P-codes etc.) renders a generic message instead.
const DOMAIN_CODES = new Set([
  "EMAIL_TAKEN",
  "INVALID_INSTITUTION",
  "INSTITUTION_INACTIVE",
  "SUBSCRIPTION_EXPIRED",
  "SEAT_LIMIT",
]);

async function clientMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
  };
}

const CreateSchema = z.object({
  institutionName: z.string().min(2, "Institution name is too short"),
  type: z.string().min(2),
  ownerName: z.string().min(2, "Enter the owner's name"),
  ownerEmail: z.string().email("Enter a valid email"),
  ownerMobile: z.string().min(7, "Enter a valid mobile number"),
  password: z.string(),
  confirm: z.string(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  website: z.string().optional(),
});

function q(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

export async function createInstitutionAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/signup?tab=create&err=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const d = parsed.data;
  if (d.password !== d.confirm) redirect(`/signup?tab=create&err=${encodeURIComponent("Passwords do not match")}`);
  const pwErr = validatePassword(d.password);
  if (pwErr) redirect(`/signup?tab=create&err=${encodeURIComponent(pwErr)}`);

  if (!(await checkRateLimit(`signup:${d.ownerEmail.toLowerCase()}`, RATE_LIMITS.signup.limit, RATE_LIMITS.signup.windowMs, { durable: true }))) {
    redirect(`/signup?tab=create&err=${encodeURIComponent("Too many attempts — try again later")}`);
  }

  let ownerId = "";
  let home = "/institution";
  try {
    const { owner } = await createInstitution({
      institutionName: d.institutionName,
      type: d.type,
      ownerName: d.ownerName,
      ownerEmail: d.ownerEmail,
      ownerMobile: d.ownerMobile,
      password: d.password,
      country: d.country,
      state: d.state,
      city: d.city,
      website: d.website,
    });
    ownerId = owner.id;
    home = roleHome(owner.role);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (isDbConnectionError(e)) {
      logger.error("createInstitution failed: database unreachable", e, { route: "createInstitutionAction", email: d.ownerEmail });
      redirect(`/signup?tab=create&err=${encodeURIComponent("Service temporarily unavailable — please try again shortly.")}`);
    }
    // Only DOMAIN errors (lib/tenancy sets .code) carry user-safe messages;
    // anything else (raw Prisma text etc.) must never reach the user.
    logger.warn("createInstitution rejected", { route: "createInstitutionAction", reason: (e as Error)?.message });
    const safe = DOMAIN_CODES.has((e as { code?: string })?.code ?? "")
      ? (e as Error).message
      : "Could not create institution — please try again";
    redirect(`/signup?tab=create&err=${encodeURIComponent(safe)}`);
  }

  try {
    const meta = await clientMeta();
    await prisma.loginEvent.create({ data: { userId: ownerId, ...meta, outcome: "SUCCESS" } });
    await createSession(ownerId);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    logger.error("post-signup session creation failed", e, { route: "createInstitutionAction", userId: ownerId });
    // Institution was created; ask them to sign in manually.
    redirect(`/login?notice=${encodeURIComponent("Institution created — please sign in.")}`);
  }
  redirect(home);
}

const JoinSchema = z.object({
  institutionId: z.string().min(3, "Enter the Institution ID"),
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  mobile: z.string().min(7, "Enter a valid mobile number"),
  password: z.string(),
  confirm: z.string(),
  role: z.string().min(2),
});

export async function joinInstitutionAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = JoinSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/signup?tab=join&err=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const d = parsed.data;
  if (d.password !== d.confirm) redirect(`/signup?tab=join&err=${encodeURIComponent("Passwords do not match")}`);
  const pwErr = validatePassword(d.password);
  if (pwErr) redirect(`/signup?tab=join&err=${encodeURIComponent(pwErr)}`);

  try {
    await joinInstitution({
      institutionId: d.institutionId,
      name: d.name,
      email: d.email,
      mobile: d.mobile,
      password: d.password,
      role: d.role,
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (isDbConnectionError(e)) {
      logger.error("joinInstitution failed: database unreachable", e, { route: "joinInstitutionAction", institutionId: d.institutionId });
      redirect(`/signup?tab=join&err=${encodeURIComponent("Service temporarily unavailable — please try again shortly.")}`);
    }
    logger.warn("joinInstitution rejected", { route: "joinInstitutionAction", reason: (e as Error)?.message });
    const safe = DOMAIN_CODES.has((e as { code?: string })?.code ?? "")
      ? (e as Error).message
      : "Could not join institution — please try again";
    redirect(`/signup?tab=join&err=${encodeURIComponent(safe)}`);
  }
  // Joins require admin approval, so send them to sign-in with a notice.
  redirect(`/login?notice=${encodeURIComponent("Request submitted — an institution admin will approve your account, then you can sign in.")}`);
}
