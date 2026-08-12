// Invoice read-access, shared by the PDF endpoint and the printable page so
// the scoping rules live in exactly one place:
//   staff (accountant/admin/principal) → any invoice in their tenant
//   parent  → only invoices of their own children
//   student → only their own invoices
// Everything is additionally tenant-fenced; other roles see nothing.
import { prisma } from "./prisma";

type Viewer = { id: string; role: string; tenantId: string | null };

export async function findInvoiceForViewer(viewer: Viewer, invoiceId: string) {
  if (!viewer.tenantId) return null;
  const staff = ["ACCOUNTANT", "INSTITUTION_ADMIN", "PRINCIPAL"].includes(viewer.role);
  let scope: object | null = null;
  if (staff) scope = {};
  else if (viewer.role === "PARENT")
    scope = { student: { parents: { some: { parent: { userId: viewer.id } } } } };
  else if (viewer.role === "STUDENT") scope = { student: { userId: viewer.id } };
  if (scope === null) return null;

  return prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: viewer.tenantId, ...scope },
    include: {
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
      tenant: { select: { name: true, institutionId: true, city: true, state: true } },
      student: { include: { user: true, class: true, section: true } },
    },
  });
}
