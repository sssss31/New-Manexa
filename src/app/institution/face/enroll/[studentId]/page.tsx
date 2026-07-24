import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FaceCapture } from "@/components/face/FaceCapture";

export default async function EnrollStudent({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId: user.tenantId! },
    include: { user: true, class: true, section: true },
  });
  if (!student) notFound();

  return (
    <>
      <PageHeader
        title={`Enrol — ${student.user.displayName}`}
        sub={`${student.class.name} ${student.section.name} · Admission ${student.admissionNo}`}
        actions={<Link href="/institution/face/enroll" className="btn-secondary">← All students</Link>}
      />
      <FaceCapture subjectType="STUDENT" subjectId={student.id} subjectName={student.user.displayName} />
    </>
  );
}
