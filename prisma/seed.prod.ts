// PRODUCTION bootstrap seed — platform essentials ONLY. No demo tenants,
// students, fees, or attendance. Idempotent (safe to re-run). Institutions are
// created at runtime via the self-serve "Create Institution" flow.
//
// Run once after `prisma migrate deploy`:  npm run db:seed:prod
// Requires SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD in the environment.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

const PLANS = [
  { code: "STARTER", name: "Starter", perStudentPrice: 15, storageGb: 10, supportLevel: "STANDARD", features: ["SIS", "Attendance", "Fee", "Communication", "Notice", "Parent App"] },
  { code: "STANDARD", name: "Standard", perStudentPrice: 30, storageGb: 25, supportLevel: "STANDARD", features: ["Starter modules", "LMS", "Examination", "Timetable", "Reports", "Activities"] },
  { code: "PRO", name: "Pro", perStudentPrice: 55, storageGb: 100, supportLevel: "PRIORITY", features: ["Standard modules", "LEAD/CRM", "HR", "Payroll", "Transport", "Library", "Inventory", "Health"] },
  { code: "ENTERPRISE", name: "Enterprise", perStudentPrice: 90, storageGb: 500, supportLevel: "DEDICATED", features: ["All 28 modules", "Hostel", "Dedicated DB", "Custom workflows", "SLA"] },
];

async function main() {
  console.log("🚀 production bootstrap seed (platform essentials only)…");

  // 1) Subscription plans (catalog) — upsert so re-runs are safe.
  for (const p of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: { name: p.name, perStudentPrice: p.perStudentPrice, storageGb: p.storageGb, supportLevel: p.supportLevel, features: JSON.stringify(p.features) },
      create: { code: p.code, name: p.name, perStudentPrice: p.perStudentPrice, storageGb: p.storageGb, supportLevel: p.supportLevel, features: JSON.stringify(p.features) },
    });
  }
  console.log(`  ↳ ${PLANS.length} subscription plans`);

  // 2) Permission catalog (referenced by per-tenant RolePermission grants).
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: perm.key }, update: { label: perm.label, category: perm.category }, create: perm });
  }
  console.log(`  ↳ ${PERMISSIONS.length} permissions`);

  // 3) Platform super-admin — from env, never hardcoded.
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("  ⚠️  SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping super-admin. Set them and re-run to create the platform operator.");
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { role: "SUPER_ADMIN", status: "ACTIVE" },
      create: { email, passwordHash, displayName: "Platform Admin", role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    console.log(`  ↳ super-admin: ${email}`);
  }

  console.log("✅ production bootstrap complete. Institutions self-register via /signup.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
