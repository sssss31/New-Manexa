import { PageHeader, SectionCard, KV } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Platform settings" sub="Global posture of the MANEXA platform" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Deployment">
          <KV k="Region" v="ap-south-1 · Mumbai" />
          <KV k="DR region" v="ap-south-2 · Hyderabad (pilot-light)" />
          <KV k="Kubernetes" v="EKS 1.30 LTS" />
          <KV k="Service mesh" v="Istio · mTLS everywhere" />
          <KV k="CI/CD" v="GitHub Actions → ArgoCD → Argo Rollouts" />
        </SectionCard>
        <SectionCard title="Compliance">
          <KV k="Data residency" v="India-only (DPDP Act 2023)" />
          <KV k="Encryption at rest" v="AES-256 via AWS KMS" />
          <KV k="Encryption in transit" v="TLS 1.3" />
          <KV k="MFA" v="TOTP mandatory for admin & finance" />
          <KV k="Audit log" v="Append-only · 7-year retention" />
        </SectionCard>
        <SectionCard title="Datastores">
          <KV k="Operational" v="MongoDB (documents)" />
          <KV k="Financial" v="PostgreSQL (ACID)" />
          <KV k="Cache/queue" v="Redis" />
          <KV k="Search" v="OpenSearch" />
          <KV k="Analytics" v="ClickHouse" />
          <KV k="Objects" v="S3 · CloudFront CDN" />
        </SectionCard>
        <SectionCard title="Rate limits">
          <KV k="Public API default" v="1000 req/min per key" />
          <KV k="Webhook signature" v="HMAC-SHA256, 5-min window" />
          <KV k="Session TTL" v="15 min access · 12 h refresh" />
          <KV k="Idempotency window" v="24 h on POST" />
        </SectionCard>
      </div>
    </>
  );
}
