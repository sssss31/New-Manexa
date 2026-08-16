import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight, Sparkles, ScanFace, Brain, MessageSquareText, IndianRupee, CalendarCheck,
  GraduationCap, Bus, Bell, ShieldCheck, Zap, BarChart3, Users, BookOpen, Building2,
  LineChart, Check, Star, Workflow, Lock,
} from "lucide-react";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/marketing/Nav";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/Reveal";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { Faq } from "@/components/marketing/Faq";
import { BarChart, DonutChart } from "@/components/Charts";

const aiFeatures = [
  { icon: Brain, title: "Student risk prediction", body: "Composite scoring over attendance, academics and fee stress flags at-risk students before they slip." },
  { icon: MessageSquareText, title: "Natural-language search", body: "Ask “who is likely to default on fees?” in plain English and get live answers from your own data." },
  { icon: ScanFace, title: "Face-recognition attendance", body: "Walk students past a camera — encrypted embeddings, liveness checks, automatic marking." },
  { icon: LineChart, title: "Performance analytics", body: "Exam trends, class-wise and teacher-wise insights, and smart report cards in a click." },
  { icon: IndianRupee, title: "Fee-defaulter forecasting", body: "Probability-ranked families based on overdue status and historic payment behaviour." },
  { icon: Sparkles, title: "AI assistant", body: "A copilot for principals — risk, fees, attendance and enrolment, answered instantly." },
];

const modules = [
  { icon: Users, label: "Admissions & SIS" },
  { icon: CalendarCheck, label: "Attendance" },
  { icon: IndianRupee, label: "Fees & Payments" },
  { icon: GraduationCap, label: "Exams & Results" },
  { icon: BookOpen, label: "LMS & Homework" },
  { icon: Bus, label: "Transport" },
  { icon: Building2, label: "Hostel & Library" },
  { icon: Bell, label: "Parent App" },
];

const plans = [
  { name: "Starter", price: 15, tag: "Small schools", features: ["SIS & Admissions", "Attendance", "Fees", "Parent app", "Notices"], cta: "Start free" },
  { name: "Standard", price: 30, tag: "Growing schools", features: ["Everything in Starter", "LMS & Exams", "Timetable", "Reports", "Events"], cta: "Start free" },
  { name: "Pro", price: 55, tag: "Most popular", popular: true, features: ["Everything in Standard", "AI insights & assistant", "Face attendance", "HR & Payroll", "Transport, Library, Hostel"], cta: "Start free" },
  { name: "Enterprise", price: 90, tag: "Multi-campus", features: ["Everything in Pro", "All 28 modules", "Dedicated DB option", "Custom workflows", "Priority SLA"], cta: "Talk to us" },
];

const testimonials = [
  { quote: "We spotted our bottom-quartile students in the first week and acted before term-end. That's never happened before.", role: "Principal", org: "CBSE School" },
  { quote: "Fee collection went from spreadsheets to one dashboard. Defaulter reminders now go out on their own.", role: "Accountant", org: "Coaching Institute" },
  { quote: "Face attendance removed 20 minutes of roll-call from every morning. Parents get alerts instantly.", role: "Class Teacher", org: "Day School" },
];

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(roleHome(user.role));

  return (
    <main className="relative min-h-screen bg-black text-white overflow-x-hidden">
      <Nav />

      {/* ===== HERO ===== */}
      <section className="relative pt-36 pb-24 px-4 mkt-noise">
        <div className="absolute inset-0 mkt-grid" aria-hidden />
        <div className="mkt-orb mkt-orb-green w-[520px] h-[520px] -top-40 -left-40 mkt-drift" aria-hidden />
        <div className="mkt-orb mkt-orb-mint w-[440px] h-[440px] top-10 right-[-120px] mkt-drift" aria-hidden style={{ animationDelay: "-6s" }} />
        <div className="mkt-orb mkt-orb-dim w-[380px] h-[380px] top-[420px] left-1/4 mkt-drift" aria-hidden style={{ animationDelay: "-10s" }} />

        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <span className="mkt-chip"><Sparkles size={13} /> AI-powered School Management, built for 2026</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05] font-display">
              Run your entire<br className="hidden sm:block" /> institution with{" "}
              <span className="mkt-gradient-text">one AI platform</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              MANEXA unifies admissions, attendance, fees, exams, transport and parent
              engagement — with AI that predicts risk, forecasts defaulters and answers
              questions about your school in plain English.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup?tab=create" className="mkt-btn-primary">
                Create your institution <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="mkt-btn-ghost">Open a demo</Link>
            </div>
            <p className="mt-4 text-sm text-white/40">14-day free trial · no card required · isolated <span className="font-mono text-accent">MAN-XXX-######</span> ID per school</p>
          </Reveal>
        </div>

        <Reveal delay={0.32} className="relative mt-20">
          <HeroVisual />
        </Reveal>
      </section>

      {/* ===== TRUST STRIP ===== */}
      <section className="relative py-14 px-4 border-y border-white/8">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs uppercase tracking-[0.25em] text-white/40 mb-8">Built for every kind of institution</p>
          <RevealGroup className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {["Schools", "Colleges", "Universities", "Coaching", "Academies", "Training Centers"].map((t) => (
              <RevealItem key={t} className="text-lg md:text-xl font-medium text-white/45">{t}</RevealItem>
            ))}
          </RevealGroup>
          <RevealGroup className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { v: "28", k: "Modules, one platform" },
              { v: "7", k: "Role-based portals" },
              { v: "<300ms", k: "AI recognition target" },
              { v: "100%", k: "Tenant data isolation" },
            ].map((s) => (
              <RevealItem key={s.k} className="text-center">
                <div className="text-3xl md:text-4xl font-semibold mkt-gradient-text tabular-nums">{s.v}</div>
                <div className="text-sm text-white/50 mt-1">{s.k}</div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ===== AI FEATURES ===== */}
      <section id="features" className="relative py-28 px-4">
        <div className="mkt-orb mkt-orb-green w-[500px] h-[500px] top-40 right-[-160px] opacity-30" aria-hidden />
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="mkt-chip"><Brain size={13} /> AI-first</span>
            <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight font-display">Intelligence baked into every module</h2>
            <p className="mt-4 text-white/55 text-lg">Not a chatbot bolted on top — AI that reads your live data and helps you act.</p>
          </Reveal>

          <RevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-14">
            {aiFeatures.map((f) => (
              <RevealItem key={f.title} className="mkt-card p-6">
                <div className="w-11 h-11 rounded-xl bg-accent/12 border border-accent/25 flex items-center justify-center text-accent mb-4">
                  <f.icon size={20} />
                </div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">{f.body}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ===== PRODUCT SHOWCASE ===== */}
      <section id="product" className="relative py-28 px-4 border-t border-white/8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <span className="mkt-chip"><BarChart3 size={13} /> One cockpit</span>
            <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight font-display">Every number, visualised — never a spreadsheet</h2>
            <p className="mt-4 text-white/55 text-lg leading-relaxed">
              Admissions trend, fee mix, class strength, attendance heatmaps and exam
              performance — live, interactive and on-brand. Decisions in seconds, not reports.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {modules.map((m) => (
                <div key={m.label} className="flex items-center gap-2.5 text-sm text-white/70">
                  <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-accent"><m.icon size={15} /></span>
                  {m.label}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative">
            <div className="absolute -inset-6 mkt-orb mkt-orb-mint opacity-30" aria-hidden />
            <div className="relative mkt-glass-strong rounded-[22px] p-5 shadow-2xl">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Class strength</div>
              <BarChart data={[{ label: "VI", value: 42 }, { label: "VII", value: 38 }, { label: "VIII", value: 45 }, { label: "IX", value: 40 }, { label: "X", value: 36 }]} height={150} />
              <div className="h-px bg-white/8 my-4" />
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Fee mix (₹ thousands)</div>
              <DonutChart segments={[{ label: "Paid", value: 420 }, { label: "Due", value: 90 }, { label: "Overdue", value: 30 }]} size={150} centerLabel="540k" centerSub="invoiced" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== WORKFLOW ===== */}
      <section className="relative py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="mkt-chip"><Workflow size={13} /> Live in minutes</span>
            <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight font-display">From sign-up to running your school</h2>
          </Reveal>
          <RevealGroup className="grid md:grid-cols-3 gap-4 mt-14">
            {[
              { n: "01", t: "Create your institution", d: "Get a unique MANEXA ID and an auto-provisioned academic session, classes and permissions." },
              { n: "02", t: "Bring your people in", d: "Add students, staff and parents by role — each gets their own secure portal instantly." },
              { n: "03", t: "Let the AI work", d: "Attendance, fees and exams flow in; AI surfaces risks, defaulters and trends automatically." },
            ].map((s) => (
              <RevealItem key={s.n} className="mkt-card p-6">
                <div className="text-4xl font-semibold mkt-gradient-text font-display">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold text-white">{s.t}</h3>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">{s.d}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ===== WHY / BENTO ===== */}
      <section className="relative py-28 px-4 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight font-display">Enterprise-grade under the hood</h2>
            <p className="mt-4 text-white/55 text-lg">Multi-tenant, secure and fast — architecture that scales from one school to thousands.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4">
            <Reveal className="mkt-card p-7 md:col-span-2">
              <ShieldCheck className="text-accent mb-4" size={24} />
              <h3 className="text-xl font-semibold">Complete tenant isolation</h3>
              <p className="mt-2 text-white/55 leading-relaxed max-w-lg">Every institution runs on its own isolated data with a unique MANEXA ID. Encrypted biometric templates, audit logs on every money & security action, and role-based access down to the permission.</p>
            </Reveal>
            <Reveal delay={0.06} className="mkt-card p-7">
              <Zap className="text-accent mb-4" size={24} />
              <h3 className="text-xl font-semibold">Fast by design</h3>
              <p className="mt-2 text-white/55 leading-relaxed">Server-rendered, indexed queries and streaming dashboards — snappy even on millions of records.</p>
            </Reveal>
            <Reveal delay={0.06} className="mkt-card p-7">
              <Lock className="text-accent mb-4" size={24} />
              <h3 className="text-xl font-semibold">Secure sessions</h3>
              <p className="mt-2 text-white/55 leading-relaxed">httpOnly cookies, rate-limited logins, password policies and login-history tracking out of the box.</p>
            </Reveal>
            <Reveal delay={0.12} className="mkt-card p-7 md:col-span-2">
              <Bell className="text-accent mb-4" size={24} />
              <h3 className="text-xl font-semibold">Parents, always in the loop</h3>
              <p className="mt-2 text-white/55 leading-relaxed max-w-lg">Automatic alerts for attendance, fees and results across the parent app — email, SMS and WhatsApp-ready, no manual effort.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="relative py-28 px-4">
        <div className="mkt-orb mkt-orb-green w-[480px] h-[480px] top-20 left-1/2 -translate-x-1/2 opacity-25" aria-hidden />
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="mkt-chip"><IndianRupee size={13} /> Simple, per-student</span>
            <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight font-display">Pricing that scales with you</h2>
            <p className="mt-4 text-white/55 text-lg">Per active student, per month. 14-day free trial on every plan.</p>
          </Reveal>
          <RevealGroup className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-14">
            {plans.map((p) => (
              <RevealItem
                key={p.name}
                className={`relative rounded-[20px] p-6 border ${p.popular ? "border-accent/50 bg-accent/[0.04]" : "border-white/10 bg-white/[0.02]"}`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 mkt-chip !bg-accent !text-black !border-accent text-xs font-semibold"><Star size={12} /> Most popular</span>
                )}
                <div className="text-white/50 text-xs uppercase tracking-wider">{p.tag}</div>
                <h3 className="text-2xl font-semibold mt-1">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tabular-nums">₹{p.price}</span>
                  <span className="text-white/45 text-sm">/student/mo</span>
                </div>
                <Link href="/signup?tab=create" className={`mt-5 w-full justify-center ${p.popular ? "mkt-btn-primary" : "mkt-btn-ghost"}`}>{p.cta}</Link>
                <ul className="mt-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/65">
                      <Check size={16} className="text-accent shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="relative py-28 px-4 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight font-display">Loved by the people who run schools</h2>
          </Reveal>
          <RevealGroup className="grid md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <RevealItem key={t.quote} className="mkt-card p-6 flex flex-col">
                <div className="flex gap-0.5 text-accent mb-3">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
                <blockquote className="text-white/80 leading-relaxed flex-1">“{t.quote}”</blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="text-white font-medium">{t.role}</span>
                  <span className="text-white/45"> · {t.org}</span>
                </figcaption>
              </RevealItem>
            ))}
          </RevealGroup>
          <p className="text-center text-xs text-white/30 mt-6">Illustrative — representative of MANEXA users.</p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="relative py-28 px-4">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight font-display">Questions, answered</h2>
          </Reveal>
          <Reveal delay={0.05}><Faq /></Reveal>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="relative py-28 px-4">
        <Reveal className="relative max-w-4xl mx-auto text-center mkt-glass-strong rounded-[28px] p-12 md:p-16 overflow-hidden">
          <div className="mkt-orb mkt-orb-green w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-40" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight font-display">Give your school an unfair advantage</h2>
            <p className="mt-4 text-white/60 text-lg max-w-xl mx-auto">Launch your institution on MANEXA in minutes. Your first 14 days are on us.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup?tab=create" className="mkt-btn-primary">Get started free <ArrowRight size={16} /></Link>
              <Link href="/signup?tab=join" className="mkt-btn-ghost">Join an institution</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="relative border-t border-white/8 px-4 py-14">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="mb-3"><Logo /></div>
            <p className="text-sm text-white/45 leading-relaxed">AI-powered School Management for the modern institution.</p>
          </div>
          {[
            { h: "Product", links: [["Features", "#features"], ["Product", "#product"], ["Pricing", "#pricing"], ["FAQ", "#faq"]] },
            { h: "Get started", links: [["Create institution", "/signup?tab=create"], ["Join institution", "/signup?tab=join"], ["Sign in", "/login"]] },
            { h: "Platform", links: [["Multi-tenant", "#product"], ["AI insights", "#features"], ["Security", "#"]] },
          ].map((col) => (
            <div key={col.h}>
              <div className="text-xs uppercase tracking-wider text-white/40 mb-3">{col.h}</div>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-sm text-white/60 hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/35">
          <span>© {new Date().getFullYear()} MANEXA · Engineering the future of education</span>
          <span>Built AI-first for 2026</span>
        </div>
      </footer>
    </main>
  );
}
