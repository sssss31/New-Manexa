import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { redirect } from "next/navigation";

const modules = [
  { name: "LEAD & Admissions", detail: "Capture, nurture, convert" },
  { name: "Student Information", detail: "360° student record" },
  { name: "Attendance", detail: "Online, offline, biometric" },
  { name: "Timetable", detail: "Conflict-free, auto-optimized" },
  { name: "LMS", detail: "Courses, lessons, assignments" },
  { name: "Examination & Results", detail: "Blueprint → paper → report card" },
  { name: "Fee Management", detail: "Invoices, UPI, reconciliation" },
  { name: "Communication", detail: "SMS, WhatsApp, Email, Push" },
  { name: "Transport", detail: "Routes, GPS, RFID" },
  { name: "HR & Payroll", detail: "Statutory-ready" },
  { name: "Library", detail: "Barcode, fines, digital" },
  { name: "Automation Engine", detail: "No-code triggers → actions" },
];

const roles = [
  { email: "super@manexa.test", role: "Super Admin", home: "/admin" },
  { email: "principal@stjohns.manexa.test", role: "Principal / Institution", home: "/institution" },
  { email: "teacher@stjohns.manexa.test", role: "Teacher", home: "/teacher" },
  { email: "accountant@stjohns.manexa.test", role: "Accountant", home: "/accounts" },
  { email: "parent@stjohns.manexa.test", role: "Parent", home: "/parent" },
  { email: "student@stjohns.manexa.test", role: "Student", home: "/student" },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));

  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-secondary">Sign in</Link>
          <Link href="/signup?tab=create" className="btn-primary">Create institution</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 badge badge-accent mb-6">
            <span className="dot" /> Commercial · Multi-tenant · AI-augmented
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold text-fg tracking-tight leading-[1.05]">
            Engineering the future of education.
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl">
            MANEXA is a centralized operating system for schools & colleges — LEAD to
            Alumni, in one platform. 28 modules, one automation engine, one API surface.
            Runnable MVP scaffold; production-ready architecture per SAD v1.0.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup?tab=create" className="btn-primary">Create your institution — free</Link>
            <Link href="/signup?tab=join" className="btn-secondary">Join an institution</Link>
            <Link href="/login" className="btn-ghost">Open a demo portal</Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Thousands of institutions, one platform — each fully isolated with its own
            <span className="font-mono text-accent"> MAN-XXX-###### </span> Institution ID.
          </p>
        </div>

        <div id="modules" className="mt-20">
          <div className="section-h mb-3">Module catalog · MVP subset</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {modules.map((m) => (
              <div key={m.name} className="card p-4">
                <div className="text-sm font-medium text-fg">{m.name}</div>
                <div className="text-xs text-muted mt-1">{m.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <div className="section-h mb-3">Demo logins · password <code className="text-fg">password123</code></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((r) => (
              <Link key={r.email} href={`/login?email=${encodeURIComponent(r.email)}`} className="card p-4 row-hover block">
                <div className="text-xs uppercase tracking-wider text-muted">{r.role}</div>
                <div className="text-sm font-medium text-fg mt-1">{r.email}</div>
                <div className="text-xs text-accent mt-2">Go to {r.home} →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border mt-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted">
          <div>MANEXA SCMS · v0.1 MVP · mirrors SRS v2.0 + SAD v1.0</div>
          <div>Built for demo · dark-first UI</div>
        </div>
      </footer>
    </div>
  );
}
