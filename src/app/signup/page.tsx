import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { INSTITUTION_TYPES, JOINABLE_ROLES } from "@/lib/tenancy";
import { createInstitutionAction, joinInstitutionAction } from "./actions";
import { RegistrationWizard } from "@/components/auth/RegistrationWizard";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ tab?: string; err?: string }> }) {
  const { tab = "create", err } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));
  const isCreate = tab !== "join";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-6xl mx-auto w-full px-6 py-5 flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        <Link href="/login" className="btn-secondary text-sm">Sign in</Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-semibold text-fg tracking-tight">Get started with MANEXA</h1>
            <p className="text-sm text-muted mt-2">
              Launch a new institution or join one that already runs on MANEXA.
            </p>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface border border-border mb-5">
            <Link
              href="/signup?tab=create"
              className={`text-center text-sm py-2.5 rounded-xl transition-colors ${isCreate ? "bg-accent/10 text-accent border border-accent/40" : "text-muted hover:text-fg"}`}
            >
              Create Institution
            </Link>
            <Link
              href="/signup?tab=join"
              className={`text-center text-sm py-2.5 rounded-xl transition-colors ${!isCreate ? "bg-accent/10 text-accent border border-accent/40" : "text-muted hover:text-fg"}`}
            >
              Join Existing
            </Link>
          </div>

          {err && !isCreate && <div className="badge badge-error w-full py-2 justify-center mb-4">{decodeURIComponent(err)}</div>}

          <div className="card p-6">
            {isCreate ? (
              <RegistrationWizard types={INSTITUTION_TYPES.map((t) => ({ value: t.value, label: t.label }))} action={createInstitutionAction} err={err} />
            ) : (
              <form action={joinInstitutionAction} className="space-y-4">
                <div>
                  <label className="label">Institution ID</label>
                  <input className="input font-mono" name="institutionId" placeholder="MAN-SCH-100001" required />
                  <p className="text-xs text-muted mt-1">Ask your institution admin for this ID.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="label">Full name</label><input className="input" name="name" required /></div>
                  <div>
                    <label className="label">Role</label>
                    <select className="select" name="role" defaultValue="TEACHER" required>
                      {JOINABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Email</label><input className="input" name="email" type="email" required /></div>
                  <div><label className="label">Mobile</label><input className="input" name="mobile" required /></div>
                  <div><label className="label">Password</label><input className="input" name="password" type="password" required /></div>
                  <div><label className="label">Confirm password</label><input className="input" name="confirm" type="password" required /></div>
                </div>
                <p className="text-xs text-muted">
                  Your request goes to the institution admin for approval. Students are admitted directly by their institution.
                </p>
                <button className="btn-primary w-full">Request to join</button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-muted mt-4">
            Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
