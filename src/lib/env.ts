// Fail-fast environment validation. Imported by prisma.ts (which every server
// route pulls in), so a misconfigured deploy crashes at boot with a clear
// message instead of throwing deep in a request.
//
// Prisma's CLI + seed auto-load `.env` (not `.env.local`), and the face-crypto
// key derives from SESSION_SECRET — so DB/app secrets live in `.env`, while
// `.env.local` is reserved for Next-only overrides.

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // PostgreSQL only — SQLite (file:) is rejected so the two never get mixed.
  DATABASE_URL: z
    .string()
    .url()
    .refine((u) => u.startsWith("postgres://") || u.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a PostgreSQL connection string (postgres://…)",
    }),

  // Session signing / cookie secret. Weak secrets are rejected in production.
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),

  // Optional dedicated biometric-template key; falls back to SESSION_SECRET.
  FACE_ENC_KEY: z.string().min(16).optional(),

  // Optional — enables the Redis-backed rate limiter / cache when set.
  REDIS_URL: z.string().url().optional(),

  // Demo mode: "true" shows sample credentials on the login screen. Leave unset
  // in production so no demo accounts/passwords are exposed.
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).optional(),

  // Supabase JS keys — OPTIONAL. The data layer talks SQL directly via Prisma
  // (DATABASE_URL) and does NOT require these. They're only needed if/when the
  // app adds supabase-js features (realtime subscriptions, storage, edge auth).
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  // Production super-admin bootstrap (used by `npm run db:seed:prod`).
  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().min(8).optional(),
});

// `next build` runs with NODE_ENV=production but is NOT the running server, so
// the strict production checks below must not abort the build. Next sets this
// phase env during compilation.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    const msg = `Invalid environment variables:\n${issues}\n\nCopy .env.example → .env and fill in the values.`;
    // Hard-fail only when actually serving in production; warn otherwise.
    if (process.env.NODE_ENV === "production" && !isBuildPhase) throw new Error(msg);
    console.warn(`⚠️  ${msg}`);
    return schema.parse({ ...process.env, SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-insecure-secret-change" });
  }
  // Block the placeholder secret from a running production server (not the build).
  if (
    parsed.data.NODE_ENV === "production" &&
    !isBuildPhase &&
    /change|insecure|dev-only/i.test(parsed.data.SESSION_SECRET)
  ) {
    throw new Error("SESSION_SECRET is still a placeholder — set a real secret in production.");
  }
  return parsed.data;
}

export const env = load();
