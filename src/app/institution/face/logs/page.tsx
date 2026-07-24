import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { dateTimeShort } from "@/lib/format";

export default async function RecognitionLogs() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const logs = await prisma.recognitionLog.findMany({
    where: { tenantId: user.tenantId! },
    orderBy: { at: "desc" },
    take: 500,
  });
  const rows = logs.map((l) => ({
    when: dateTimeShort(l.at),
    decision: l.decision.replace(/_/g, " "),
    confidence: l.confidence,
    liveness: l.livenessScore,
    latency: l.latencyMs,
    session: l.sessionId?.slice(-6) ?? "—",
  }));
  return (
    <>
      <PageHeader title="Recognition logs" sub="Every scan decision — audit-grade, exportable. No biometric data exposed." />
      <SectionCard>
        <DataTable
          exportName="recognition-logs"
          searchPlaceholder="Filter by decision…"
          columns={[
            { key: "when", label: "When" },
            { key: "decision", label: "Decision" },
            { key: "confidence", label: "Conf %", numeric: true },
            { key: "liveness", label: "Liveness", numeric: true },
            { key: "latency", label: "Latency ms", numeric: true },
            { key: "session", label: "Session" },
          ]}
          rows={rows}
        />
      </SectionCard>
    </>
  );
}
