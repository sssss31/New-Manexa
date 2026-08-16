import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AttendanceSession } from "@/components/face/AttendanceSession";

export default async function LiveAttendancePage() {
  const user = await requireRole("TEACHER");
  const tenantId = user.tenantId!;
  const [sections, subjects, devices] = await Promise.all([
    prisma.section.findMany({
      where: { tenantId },
      include: { class: true },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.subject.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.attendanceDevice.findMany({ where: { tenantId, status: "ONLINE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Live face attendance"
        sub="Camera-driven check-in · confidence threshold · anti-spoof liveness · duplicate-safe"
      />
      <AttendanceSession
        sections={sections.map((s) => ({ id: s.id, classId: s.classId, label: `${s.class.name} ${s.name}` }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        devices={devices.map((d) => ({ id: d.id, name: d.name }))}
      />
    </>
  );
}
