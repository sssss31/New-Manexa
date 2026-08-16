// Static app configuration (non-secret). Env-driven values come from lib/env.ts.
import { BRAND_GREEN, BRAND_GREEN_LOGO } from "@/lib/design-system";

export const site = {
  name: "MANEXA",
  tagline: "AI-Powered School Management",
  supportEmail: "support@manexa.in",
  brand: { accent: BRAND_GREEN, logo: BRAND_GREEN_LOGO },
} as const;
