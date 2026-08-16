import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { normalizeDate } from "@/lib/engine";
import { PageHeader, SectionCard } from "@/components/ui";
import { SelfCheckIn } from "@/components/face/SelfCheckIn";

export default async function TeacherSelfCheckIn() {
  const user = await requireRole("TEACHER");
  const tenantId = user.tenantId!;

  const staff = await prisma.staff.findFirst({
    where: { userId: user.id, tenantId, status: "ACTIVE" },
    include: { faceProfile: { include: { _count: { select: { samples: true } } } } },
  });

  if (!staff) {
    return (
      <>
        <PageHeader title="My Face check-in" />
        <SectionCard>
          <div className="text-sm text-muted">No active staff record is linked to your account. Ask your admin to add you as staff.</div>
        </SectionCard>
      </>
    );
  }

  const enrolled = (staff.faceProfile?._count.samples ?? 0) > 0;

  // Today's attendance (IST-anchored), if already recorded.
  const today = normalizeDate(new Date());
  const existing = await prisma.staffAttendance.findUnique({
    where: { staffId_date: { staffId: staff.id, date: today } },
    select: { status: true, firstInAt: true },
  });

  return (
    <>
      <PageHeader
        title="My Face check-in"
        sub="Mark your own attendance with Face ID — verified against your enrolment, recorded once per day."
        actions={<Link href="/teacher/face" className="btn-secondary">Manage Face ID</Link>}
      />
      <SelfCheckIn
        enrolled={enrolled}
        displayName={user.displayName}
        roleLabel="Teacher"
        initial={existing ? { status: existing.status, checkInAt: (existing.firstInAt ?? new Date()).toISOString() } : null}
      />
    </>
  );
}
