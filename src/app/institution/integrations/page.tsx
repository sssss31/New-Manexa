import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";

const CATALOG = [
  { name: "Razorpay", category: "Payments", status: "SIMULATED", detail: "UPI, cards, net-banking, EMI — webhook-driven reconciliation" },
  { name: "PayU", category: "Payments", status: "AVAILABLE", detail: "Failover gateway for admission/fee season resilience" },
  { name: "MSG91", category: "SMS", status: "SIMULATED", detail: "DLT-registered transactional + promotional SMS" },
  { name: "WhatsApp Cloud API", category: "Messaging", status: "SIMULATED", detail: "Template messages + 24h session conversations" },
  { name: "AWS SES", category: "Email", status: "SIMULATED", detail: "Bulk + transactional with bounce & complaint handling" },
  { name: "Google Maps", category: "Transport", status: "AVAILABLE", detail: "Live GPS tracking, ETA, geo-fence alerts" },
  { name: "Zoom / Google Meet", category: "Live classes", status: "AVAILABLE", detail: "Auto-created meetings from timetable" },
  { name: "Tally Prime", category: "Accounting", status: "AVAILABLE", detail: "Two-way ledger sync for the accounts office" },
  { name: "DigiLocker", category: "Documents", status: "AVAILABLE", detail: "Government-verified document pulls" },
  { name: "Biometric (eSSL/ZKTeco)", category: "Attendance", status: "AVAILABLE", detail: "Punch-event ingestion via device adapters" },
  { name: "Aadhaar e-KYC", category: "Identity", status: "AVAILABLE", detail: "Verified onboarding (UIDAI sandbox)" },
  { name: "OpenAI / Anthropic", category: "AI", status: "PLUGGABLE", detail: "LLM backend for the assistant — same answerQuery interface" },
];

export default async function IntegrationsPage() {
  await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  return (
    <>
      <PageHeader
        title="Integrations"
        sub="Every external system sits behind a versioned adapter (SAD §7.6) — vendor swaps never ripple into modules"
      />
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATALOG.map((i) => (
            <div key={i.name} className="border border-border rounded-2xl p-4 hover:border-accent/30 transition-colors">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-fg font-medium">{i.name}</div>
                <Tag tone={i.status === "SIMULATED" ? "accent" : i.status === "PLUGGABLE" ? "muted" : "success"}>
                  {i.status}
                </Tag>
              </div>
              <div className="text-xs text-subtle mt-0.5">{i.category}</div>
              <div className="text-sm text-muted mt-2">{i.detail}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-muted">
          SIMULATED — active in this environment with local fakes · AVAILABLE — adapter contract defined, connects with credentials · PLUGGABLE — interface ready, bring your key.
        </div>
      </SectionCard>
    </>
  );
}
