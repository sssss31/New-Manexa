import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { QUALITY } from "@/lib/face/descriptor";
import { updateSettingsAction } from "../actions";

export default async function FaceSettings() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const open = await prisma.faceAttendanceSession.findFirst({
    where: { tenantId, status: "OPEN" },
    orderBy: { startedAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Face system settings" sub="Recognition thresholds, quality gates and privacy posture for this institution." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Recognition parameters">
          <form action={updateSettingsAction} className="space-y-4">
            <div>
              <label className="label">Match threshold (cosine ×100)</label>
              <input className="input" name="threshold" type="number" min={50} max={99} defaultValue={open?.threshold ?? 88} />
              <p className="text-xs text-muted mt-1">Higher = stricter. Applied to open sessions immediately; new sessions inherit it.</p>
            </div>
            <div>
              <label className="label">Late cutoff (minutes after session start)</label>
              <input className="input" name="lateAfterMin" type="number" min={0} max={120} defaultValue={open?.lateAfterMin ?? 10} />
            </div>
            <button className="btn-primary w-full">Save settings</button>
          </form>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Quality gate (enforced server-side)">
            <ul className="text-sm space-y-1.5">
              <Row k="Min brightness" v={`${QUALITY.minBrightness} / 255`} />
              <Row k="Max brightness" v={`${QUALITY.maxBrightness} / 255`} />
              <Row k="Min sharpness (Laplacian var)" v={String(QUALITY.minSharpness)} />
              <Row k="Min face size" v={`${QUALITY.minFaceBoxPx}px`} />
              <Row k="Max faces per frame" v={String(QUALITY.maxFaces)} />
              <Row k="Min composite score" v={`${QUALITY.minComposite}%`} />
            </ul>
          </SectionCard>

          <SectionCard title="Privacy & security posture">
            <ul className="text-sm space-y-2 text-muted">
              <li className="flex gap-2"><Tag tone="success">AES-256-GCM</Tag> Embeddings encrypted at rest, decrypted only in the match engine.</li>
              <li className="flex gap-2"><Tag tone="success">No images</Tag> Raw face photos are never stored — only embeddings.</li>
              <li className="flex gap-2"><Tag tone="success">Server-only</Tag> Embeddings never sent to any client.</li>
              <li className="flex gap-2"><Tag tone="accent">Audited</Tag> Every enrol, mark, session and resolution is logged.</li>
              <li className="flex gap-2"><Tag tone="muted">Liveness</Tag> Motion-based anti-spoof today; ArcFace + Silent-Face model pluggable.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="font-mono text-fg">{v}</span>
    </li>
  );
}
