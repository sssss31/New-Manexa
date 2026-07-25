import Link from "next/link";
import { Logo } from "@/components/Logo";
import { loginAction } from "./actions";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { redirect } from "next/navigation";

// Demo credentials are shown ONLY when NEXT_PUBLIC_DEMO_MODE=true (dev/demo).
// In production the flag is unset, so no sample accounts or passwords appear.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const demoAccounts = [
  { email: "super@manexa.test", role: "Super Admin" },
  { email: "principal@stjohns.manexa.test", role: "Principal" },
  { email: "admin@stjohns.manexa.test", role: "Institution Admin" },
  { email: "teacher@stjohns.manexa.test", role: "Teacher" },
  { email: "accountant@stjohns.manexa.test", role: "Accountant" },
  { email: "parent@stjohns.manexa.test", role: "Parent" },
  { email: "student@stjohns.manexa.test", role: "Student" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ err?: string; email?: string; notice?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 bg-surface border-r border-border flex-col p-10 justify-between">
        <Logo />
        <div>
          <h2 className="text-3xl font-semibold text-fg tracking-tight">
            One platform. Every module.<br />From lead to alumni.
          </h2>
          <p className="text-muted mt-4 max-w-md text-sm">
            MANEXA runs the institution while educators teach — admissions to alumni,
            in one AI-powered platform.
          </p>
          {DEMO_MODE && (
            <div className="mt-6 space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-subtle mb-1">Demo accounts</div>
              {demoAccounts.map((d) => (
                <div key={d.email} className="text-xs text-muted">
                  <span className="text-fg font-medium">{d.role}</span> · {d.email}
                </div>
              ))}
              <div className="text-xs text-muted mt-3">Password for all: <span className="text-fg font-mono">password123</span></div>
            </div>
          )}
        </div>
        <div className="text-xs text-muted">© MANEXA · Engineering the Future of Education</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form action={loginAction} className="w-full max-w-sm space-y-4">
          <div className="md:hidden mb-2"><Logo /></div>
          <div>
            <h1 className="text-2xl font-semibold text-fg">Sign in</h1>
            <p className="text-sm text-muted mt-1">Access your MANEXA portal.</p>
          </div>

          {sp.err === "invalid" && (
            <div className="badge badge-error w-full py-2 justify-center">Invalid email or password</div>
          )}
          {sp.err === "locked" && (
            <div className="badge badge-warning w-full py-2 justify-center">Too many attempts — try again in 5 minutes</div>
          )}
          {sp.err === "forbidden" && (
            <div className="badge badge-warning w-full py-2 justify-center">Access denied for this portal</div>
          )}
          {sp.err === "pending" && (
            <div className="badge badge-warning w-full py-2 justify-center text-center">Your account is awaiting admin approval</div>
          )}
          {sp.err === "dbdown" && (
            <div className="badge badge-error w-full py-2 justify-center text-center">Service temporarily unavailable — please try again shortly.</div>
          )}
          {sp.err === "server" && (
            <div className="badge badge-error w-full py-2 justify-center text-center">Something went wrong signing in. Please try again.</div>
          )}
          {sp.notice && (
            <div className="badge badge-accent w-full py-2 justify-center text-center">{decodeURIComponent(sp.notice)}</div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              name="email"
              type="email"
              defaultValue={sp.email ?? ""}
              placeholder="you@school.test"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              name="password"
              type="password"
              defaultValue={DEMO_MODE ? "password123" : ""}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">Sign in</button>
          <div className="text-xs text-muted text-center">
            New here? <Link href="/signup?tab=create" className="text-accent hover:underline">Create an institution</Link> or{" "}
            <Link href="/signup?tab=join" className="text-accent hover:underline">join one</Link>
          </div>
          <div className="text-xs text-muted text-center">
            <Link href="/" className="hover:text-fg">← Back to landing</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
