import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";
import { FaceEnrollFlow } from "@/components/face/FaceEnrollFlow";
import { relative } from "@/lib/format";

export default async function TeacherFaceEnroll() {
  const user = await requireRole("TEACHER");
  const staff = await prisma.staff.findFirst({
    where: { tenantId: user.tenantId!, userId: user.id },
    include: { faceProfile: { include: { samples: { orderBy: { createdAt: "desc" } } } } },
  });

  if (!staff) {
    return (
      <>
        <PageHeader title="My face enrolment" />
        <SectionCard><div className="text-sm text-muted">No staff record linked to your account.</div></SectionCard>
      </>
    );
  }

  const profile = staff.faceProfile;

  return (
    <>
      <PageHeader
        title="My face enrolment"
        sub="Register your own face for attendance kiosks and staff check-in. Re-enrol any time — versions are tracked."
      />

      {profile && (
        <SectionCard title="Enrolment history" className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Tag tone="success">Version {profile.version}</Tag>
            <Tag tone="accent">{profile.sampleCount}/7 poses</Tag>
            <Tag tone="muted">Avg quality {profile.avgQuality}%</Tag>
          </div>
          <ul className="text-sm space-y-1">
            {profile.samples.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
                <span className="text-fg">{s.pose.replace(/(\d+)/, " $1°")}</span>
                <span className="text-xs text-muted font-mono">v{s.version} · q{s.quality}% · {relative(s.createdAt)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <FaceEnrollFlow subjectId={staff.id} subjectName={user.displayName} alreadyEnrolled={!!profile} />
    </>
  );
}
