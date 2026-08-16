import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IconCalendar, IconExam, IconGrad, IconHome, IconLibrary, IconLMS, IconMega } from "@/components/Icons";
import { headers } from "next/headers";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
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
        { section: "Today", href: "/student", label: "Dashboard", icon: <IconHome /> },
        { section: "Today", href: "/student/calendar", label: "Calendar", icon: <IconCalendar /> },
        { section: "Today", href: "/student/timetable", label: "Timetable", icon: <IconCalendar /> },
        { section: "Academic", href: "/student/courses", label: "My courses (LMS)", icon: <IconLMS /> },
        { section: "Academic", href: "/student/assignments", label: "Assignments", icon: <IconGrad /> },
        { section: "Academic", href: "/student/results", label: "Results", icon: <IconExam /> },
        { section: "Academic", href: "/student/library", label: "Library", icon: <IconLibrary /> },
        { section: "Comm", href: "/student/notices", label: "Notices", icon: <IconMega /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
