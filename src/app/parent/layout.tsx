import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IconBus, IconCash, IconHome, IconMega, IconUsers, IconLibrary, IconClipboard, IconCalendar } from "@/components/Icons";
import { headers } from "next/headers";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("PARENT");
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
        { section: "Home", href: "/parent", label: "Overview", icon: <IconHome /> },
        { section: "Home", href: "/parent/calendar", label: "Calendar", icon: <IconCalendar /> },
        { section: "Child", href: "/parent/child", label: "My child", icon: <IconUsers /> },
        { section: "Child", href: "/parent/attendance", label: "Attendance", icon: <IconClipboard /> },
        { section: "Child", href: "/parent/results", label: "Results", icon: <IconLibrary /> },
        { section: "Fee", href: "/parent/fees", label: "Fees & payments", icon: <IconCash /> },
        { section: "Ops", href: "/parent/transport", label: "Transport", icon: <IconBus /> },
        { section: "Comm", href: "/parent/notices", label: "Notices", icon: <IconMega /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
