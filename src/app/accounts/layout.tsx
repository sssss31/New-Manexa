import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IconCash, IconChart, IconHome, IconMoney, IconLog, IconMega } from "@/components/Icons";
import { headers } from "next/headers";

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ACCOUNTANT");
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
        { section: "Overview", href: "/accounts", label: "Dashboard", icon: <IconHome /> },
        { section: "Fee", href: "/accounts/invoices", label: "Invoices", icon: <IconCash /> },
        { section: "Fee", href: "/accounts/collections", label: "Collections", icon: <IconMoney /> },
        { section: "Fee", href: "/accounts/defaulters", label: "Defaulters", icon: <IconMega /> },
        { section: "People", href: "/accounts/payroll", label: "Payroll", icon: <IconMoney /> },
        { section: "Accounting", href: "/accounts/expenses", label: "Expenses & P&L", icon: <IconMoney /> },
        { section: "Analytics", href: "/accounts/reports", label: "Reports", icon: <IconChart /> },
        { section: "System", href: "/accounts/audit", label: "Audit log", icon: <IconLog /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
