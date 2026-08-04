import { redirect } from "next/navigation";
import { loginAction } from "./actions";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

// Demo credentials list is shown ONLY when NEXT_PUBLIC_DEMO_MODE=true.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const demoAccounts = [
  { email: "super@manexa.test", role: "Super Admin" },
  { email: "admin@stjohns.manexa.test", role: "Institution Admin" },
  { email: "teacher@stjohns.manexa.test", role: "Teacher" },
  { email: "parent@stjohns.manexa.test", role: "Parent" },
  { email: "student@stjohns.manexa.test", role: "Student" },
];

const ERR: Record<string, string> = {
  invalid: "Invalid email or password.",
  locked: "Too many attempts — please try again in 5 minutes.",
  forbidden: "Access denied for this portal.",
  pending: "Your account is awaiting admin approval.",
  dbdown: "Service temporarily unavailable — please try again shortly.",
  server: "Something went wrong signing in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; email?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));

  return (
    <AuthShell
      brandExtra={
        DEMO_MODE ? (
          <div className="mt-8 space-y-1.5">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-subtle">Demo accounts · password123</div>
            {demoAccounts.map((d) => (
              <div key={d.email} className="text-xs text-muted">
                <span className="font-medium text-fg">{d.role}</span> · {d.email}
              </div>
            ))}
          </div>
        ) : undefined
      }
    >
      <LoginForm
        action={loginAction}
        errorMessage={sp.err ? ERR[sp.err] ?? "Sign-in failed. Please try again." : null}
        notice={sp.notice ? decodeURIComponent(sp.notice) : null}
        defaultEmail={sp.email ?? ""}
        demoMode={DEMO_MODE}
      />
    </AuthShell>
  );
}
