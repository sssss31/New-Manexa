import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FaceCapture } from "@/components/face/FaceCapture";

export default async function EnrollStaff({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, tenantId: user.tenantId! },
    include: { user: true },
  });
  if (!staff) notFound();

  return (
    <>
      <PageHeader
        title={`Enrol — ${staff.user.displayName}`}
        sub={`${staff.designation}${staff.department ? ` · ${staff.department}` : ""} · ${staff.employeeCode}`}
        actions={<Link href="/institution/face/enroll-staff" className="btn-secondary">← All staff</Link>}
      />
      {/* subjectId is the STAFF member's record — the enrolled biometric belongs to
          them, not to the admin performing the enrolment (actorId is audited separately). */}
      <FaceCapture subjectType="STAFF" subjectId={staff.id} subjectName={staff.user.displayName} />
    </>
  );
}
