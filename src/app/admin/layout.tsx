import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import {
  IconBell,
  IconBuilding,
  IconChart,
  IconGear,
  IconHome,
  IconLog,
  IconMega,
  IconMoney,
  IconShield,
} from "@/components/Icons";
import { headers } from "next/headers";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("SUPER_ADMIN");
  const h = await headers();
  const path = h.get("x-pathname") ?? "";
  return (
    <AppShell
      role={user.role}
      displayName={user.displayName}
      userId={user.id}
      tenantName="MANEXA · Platform"
      currentPath={path}
      nav={[
        { section: "Platform", href: "/admin", label: "Overview", icon: <IconHome /> },
        { section: "Platform", href: "/admin/tenants", label: "Tenants", icon: <IconBuilding /> },
        { section: "Platform", href: "/admin/plans", label: "Plans", icon: <IconMoney /> },
        { section: "Platform", href: "/admin/subscriptions", label: "Subscriptions", icon: <IconChart /> },
        { section: "Growth", href: "/admin/banners", label: "Banners", icon: <IconMega /> },
        { section: "Growth", href: "/admin/leads", label: "Global Leads", icon: <IconBell /> },
        { section: "System", href: "/admin/users", label: "Users", icon: <IconShield /> },
        { section: "System", href: "/admin/audit", label: "Audit log", icon: <IconLog /> },
        { section: "System", href: "/admin/settings", label: "Settings", icon: <IconGear /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
