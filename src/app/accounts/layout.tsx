import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IconCash, IconChart, IconHome, IconMoney, IconLog, IconMega, IconBuilding, IconClipboard, IconCalendar } from "@/components/Icons";
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
        { section: "Overview", href: "/accounts/calendar", label: "Calendar", icon: <IconCalendar /> },
        { section: "Fee", href: "/accounts/invoices", label: "Invoices", icon: <IconCash /> },
        { section: "Fee", href: "/accounts/collections", label: "Collections", icon: <IconMoney /> },
        { section: "Fee", href: "/accounts/defaulters", label: "Defaulters", icon: <IconMega /> },
        { section: "People", href: "/accounts/payroll", label: "Payroll", icon: <IconMoney /> },
        { section: "Accounting", href: "/accounts/expenses", label: "Expenses & P&L", icon: <IconMoney /> },
        { section: "Accounting", href: "/accounts/chart-of-accounts", label: "Chart of Accounts", icon: <IconBuilding /> },
        { section: "Accounting", href: "/accounts/ledger", label: "General Ledger", icon: <IconClipboard /> },
        { section: "Accounting", href: "/accounts/trial-balance", label: "Trial Balance", icon: <IconChart /> },
        { section: "Analytics", href: "/accounts/reports", label: "Reports", icon: <IconChart /> },
        { section: "System", href: "/accounts/audit", label: "Audit log", icon: <IconLog /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
