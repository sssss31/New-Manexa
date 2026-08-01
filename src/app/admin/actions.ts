"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword, provisionedPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateInstitutionId } from "@/lib/tenancy";
import { seedTenantPermissions } from "@/lib/permissions";

const TenantSchema = z.object({
  name: z.string().min(2),
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/),
  code: z.string().min(2),
  type: z.string().default("SCHOOL"),
  board: z.string().optional(),
  isolation: z.enum(["POOLED", "BRIDGE", "SILO"]).default("POOLED"),
  planCode: z.string().optional(),
  adminEmail: z.string().email(),
  adminName: z.string().min(2),
});

export async function createTenantAction(formData: FormData) {
  const actor = await requireRole("SUPER_ADMIN");
  const raw = Object.fromEntries(formData.entries());
  const parsed = TenantSchema.safeParse(raw);
  if (!parsed.success) redirect("/admin/tenants/new?err=invalid");
  const d = parsed.data;
  const plan = d.planCode ? await prisma.subscriptionPlan.findUnique({ where: { code: d.planCode } }) : null;
  // Fail-fast duplicate checks BEFORE creating anything — a P2002 halfway
  // through used to strand the tenant in PROVISIONING with no admin.
  if (await prisma.tenant.findUnique({ where: { subdomain: d.subdomain }, select: { id: true } })) {
    redirect(`/admin/tenants/new?err=${encodeURIComponent("Subdomain already in use")}`);
  }
  if (await prisma.user.findUnique({ where: { email: d.adminEmail }, select: { id: true } })) {
    redirect(`/admin/tenants/new?err=${encodeURIComponent("Admin email already has an account")}`);
  }
  const institutionId = await generateInstitutionId(d.type);
  // Random password in production (demo password only in demo mode) — every
  // sales-onboarded admin used to go live with the public demo password.
  const pw = await hashPassword(provisionedPassword());
  const t = await prisma.tenant.create({
    data: {
      name: d.name,
      institutionId,
      type: d.type,
      subdomain: d.subdomain,
      code: d.code,
      board: d.board,
      isolation: d.isolation,
      planId: plan?.id,
      status: "PROVISIONING",
      // Billing lifecycle starts now — without this, admin-onboarded tenants
      // never expired.
      subscriptionExpiry: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    },
  });
  await seedTenantPermissions(t.id);
  if (plan) {
    // Attach a real Subscription row so seat limits + expiry are enforced
    // (plan-only tenants used to get UNLIMITED seats — a billing bypass).
    await prisma.subscription.create({
      data: {
        tenantId: t.id,
        planId: plan.id,
        studentSeats: 500,
        status: "ACTIVE",
        renewsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });
  }
  await prisma.user.create({
    data: {
      email: d.adminEmail,
      displayName: d.adminName,
      role: "INSTITUTION_ADMIN",
      tenantId: t.id,
      passwordHash: pw,
    },
  });
  await prisma.tenant.update({ where: { id: t.id }, data: { status: "ACTIVE" } });
  await audit({
    tenantId: t.id,
    actorId: actor.id,
    action: "TENANT_ONBOARD",
    entity: "Tenant",
    entityId: t.id,
    detail: `${d.name} · ${d.isolation}`,
  });
  revalidatePath("/admin/tenants");
  redirect("/admin/tenants");
}

const PlanSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  perStudentPrice: z.coerce.number().int().min(1),
  moduleLimit: z.coerce.number().int().min(0).default(0),
  storageGb: z.coerce.number().int().min(0).default(10),
  supportLevel: z.enum(["STANDARD", "PRIORITY", "DEDICATED"]).default("STANDARD"),
  features: z.string(),
});

export async function createPlanAction(formData: FormData) {
  const actor = await requireRole("SUPER_ADMIN");
  const parsed = PlanSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/admin/plans?err=invalid");
  const d = parsed.data;
  await prisma.subscriptionPlan.create({
    data: {
      code: d.code,
      name: d.name,
      perStudentPrice: d.perStudentPrice,
      moduleLimit: d.moduleLimit,
      storageGb: d.storageGb,
      supportLevel: d.supportLevel,
      features: JSON.stringify(d.features.split(",").map((s) => s.trim()).filter(Boolean)),
    },
  });
  await audit({ actorId: actor.id, action: "PLAN_CREATE", entity: "SubscriptionPlan", detail: d.code });
  revalidatePath("/admin/plans");
}

const BannerSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(1),
  audience: z.enum(["ALL", "PARENTS", "STUDENTS", "STAFF", "TENANT_ADMIN"]).default("ALL"),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
});

export async function createBannerAction(formData: FormData) {
  const actor = await requireRole("SUPER_ADMIN");
  const parsed = BannerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/admin/banners?err=invalid");
  const d = parsed.data;
  await prisma.banner.create({
    data: { ...d, status: "ACTIVE" },
  });
  await audit({ actorId: actor.id, action: "BANNER_CREATE", entity: "Banner", detail: d.title });
  revalidatePath("/admin/banners");
}

export async function toggleBannerAction(formData: FormData) {
  const actor = await requireRole("SUPER_ADMIN");
  const id = String(formData.get("id"));
  const b = await prisma.banner.findUnique({ where: { id } });
  if (!b) return;
  const next = b.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  await prisma.banner.update({ where: { id }, data: { status: next } });
  await audit({ actorId: actor.id, action: "BANNER_TOGGLE", entity: "Banner", entityId: id, detail: next });
  revalidatePath("/admin/banners");
}
