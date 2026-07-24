import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat } from "@/components/ui";
import { relative } from "@/lib/format";
import { UnknownActions } from "@/components/face/UnknownActions";

export default async function UnknownFaces() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [open, resolved] = await Promise.all([
    prisma.unknownFace.findMany({
      where: { tenantId, resolved: false },
      orderBy: { seenAt: "desc" },
      take: 100,
      select: { id: true, bestScore: true, seenAt: true, sessionId: true }, // never select embedding
    }),
    prisma.unknownFace.count({ where: { tenantId, resolved: true } }),
  ]);

  return (
    <>
      <PageHeader title="Unknown faces" sub="Scans that didn't match any enrolled student. Resolve each — no images stored, only encrypted descriptors." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Stat label="Unresolved" value={open.length} tone={open.length ? "error" : "success"} />
        <Stat label="Resolved" value={resolved} />
        <Stat label="Privacy" value="Descriptor-only" sub="No raw images retained" tone="accent" />
      </div>
      <SectionCard>
        {open.length === 0 && <div className="text-sm text-muted">No unknown faces pending. 🎉</div>}
        <div className="space-y-2">
          {open.map((u) => (
            <div key={u.id} className="flex items-center justify-between border border-border rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-error/15 text-error flex items-center justify-center text-lg">?</div>
                <div>
                  <div className="text-fg font-medium">Unknown face</div>
                  <div className="text-xs text-muted font-mono">closest match {u.bestScore}% · {relative(u.seenAt)}</div>
                </div>
              </div>
              <UnknownActions id={u.id} />
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
