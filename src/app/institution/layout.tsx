import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  IconBuilding,
  IconBus,
  IconCalendar,
  IconChart,
  IconClipboard,
  IconExam,
  IconGear,
  IconGrad,
  IconHome,
  IconLead,
  IconLibrary,
  IconLog,
  IconMega,
  IconMoney,
  IconShield,
  IconUsers,
  IconWorkflow,
} from "@/components/Icons";
import { headers } from "next/headers";

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
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
        { section: "Overview", href: "/institution", label: "Cockpit", icon: <IconHome /> },
        { section: "AI", href: "/institution/ai", label: "AI Insights", icon: <IconChart /> },
        { section: "AI", href: "/institution/assistant", label: "Assistant", icon: <IconLead /> },
        { section: "Face Attendance", href: "/institution/face", label: "Face Dashboard", icon: <IconClipboard /> },
        { section: "Face Attendance", href: "/institution/face/enroll", label: "Enrolment", icon: <IconUsers /> },
        { section: "Face Attendance", href: "/institution/staff-attendance", label: "Staff Attendance", icon: <IconClipboard /> },
        { section: "Face Attendance", href: "/institution/face/reports", label: "Reports", icon: <IconChart /> },
        { section: "Face Attendance", href: "/institution/face/unknown", label: "Unknown faces", icon: <IconShield /> },
        { section: "Face Attendance", href: "/institution/face/logs", label: "Recognition logs", icon: <IconLog /> },
        { section: "Face Attendance", href: "/institution/face/devices", label: "Devices", icon: <IconBuilding /> },
        { section: "Face Attendance", href: "/institution/face/settings", label: "Settings", icon: <IconGear /> },
        { section: "Lifecycle", href: "/institution/leads", label: "Leads & Admission", icon: <IconLead /> },
        { section: "Lifecycle", href: "/institution/students", label: "Students (SIS)", icon: <IconUsers /> },
        { section: "Academics", href: "/institution/classes", label: "Classes & Sections", icon: <IconBuilding /> },
        { section: "Academics", href: "/institution/subjects", label: "Subjects & Timetable", icon: <IconCalendar /> },
        { section: "Academics", href: "/institution/exams", label: "Exams & Results", icon: <IconGrad /> },
        { section: "Finance", href: "/institution/fees", label: "Fee structures", icon: <IconMoney /> },
        { section: "Operations", href: "/institution/transport", label: "Transport", icon: <IconBus /> },
        { section: "Operations", href: "/institution/hostel", label: "Hostel", icon: <IconBuilding /> },
        { section: "Operations", href: "/institution/library", label: "Library", icon: <IconLibrary /> },
        { section: "Operations", href: "/institution/inventory", label: "Inventory", icon: <IconClipboard /> },
        { section: "Engagement", href: "/institution/notices", label: "Notices", icon: <IconMega /> },
        { section: "Engagement", href: "/institution/events", label: "Events", icon: <IconCalendar /> },
        { section: "Engagement", href: "/institution/automations", label: "Automation Engine", icon: <IconWorkflow /> },
        { section: "Documents", href: "/institution/certificates", label: "Certificates & ID cards", icon: <IconExam /> },
        { section: "System", href: "/institution/staff", label: "Staff (HR)", icon: <IconUsers /> },
        { section: "System", href: "/institution/join-requests", label: "Join Requests", icon: <IconShield /> },
        { section: "System", href: "/institution/reports", label: "Reports", icon: <IconChart /> },
        { section: "System", href: "/institution/roles", label: "Roles & permissions", icon: <IconShield /> },
        { section: "System", href: "/institution/integrations", label: "Integrations", icon: <IconWorkflow /> },
        { section: "System", href: "/institution/audit", label: "Audit log", icon: <IconLog /> },
        { section: "System", href: "/institution/settings", label: "Settings", icon: <IconGear /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
