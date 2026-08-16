import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  IconCalendar,
  IconClipboard,
  IconExam,
  IconFace,
  IconGrad,
  IconHome,
  IconLMS,
  IconMega,
} from "@/components/Icons";
import { headers } from "next/headers";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER");
  const tenant = user.tenantId ? await prisma.tenant.findUnique({ where: { id: user.tenantId } }) : null;
  const h = await headers();
  const path = h.get("x-pathname") ?? "";
  return (
    <AppShell
      role={user.role}
      displayName={user.displayName}
      userId={user.id}
      tenantName={tenant?.name}
      currentPath={path}
      nav={[
        { section: "Today", href: "/teacher", label: "Dashboard", icon: <IconHome /> },
        { section: "Today", href: "/teacher/calendar", label: "Calendar", icon: <IconCalendar /> },
        { section: "Today", href: "/teacher/attendance/self", label: "My Face check-in", icon: <IconFace /> },
        { section: "Today", href: "/teacher/attendance", label: "Class attendance", icon: <IconClipboard /> },
        { section: "Today", href: "/teacher/attendance/live", label: "Class face attendance", icon: <IconFace /> },
        { section: "Academic", href: "/teacher/courses", label: "Courses (LMS)", icon: <IconLMS /> },
        { section: "Academic", href: "/teacher/assignments", label: "Assignments", icon: <IconGrad /> },
        { section: "Academic", href: "/teacher/exams", label: "Exams", icon: <IconExam /> },
        { section: "Academic", href: "/teacher/timetable", label: "Timetable", icon: <IconCalendar /> },
        { section: "Comm", href: "/teacher/notices", label: "Notices", icon: <IconMega /> },
        { section: "Account", href: "/teacher/leave", label: "My Leave", icon: <IconCalendar /> },
        { section: "Account", href: "/teacher/face", label: "My face enrolment", icon: <IconFace /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
