import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, Tag } from "@/components/ui";
import { relative, inr } from "@/lib/format";

export default async function LibraryPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [items, loans] = await Promise.all([
    prisma.libraryItem.findMany({ where: { tenantId }, orderBy: { title: "asc" } }),
    prisma.libraryLoan.findMany({
      where: { item: { tenantId } },
      include: { student: { include: { user: true } }, item: true },
      orderBy: { borrowedAt: "desc" },
      take: 20,
    }),
  ]);
  const totalCopies = items.reduce((s, i) => s + i.copies, 0);
  const available = items.reduce((s, i) => s + i.available, 0);
  const overdue = loans.filter((l) => !l.returnedAt && l.dueAt < new Date());
  return (
    <>
      <PageHeader title="Library" sub={`${items.length} titles · ${totalCopies} copies`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Titles" value={items.length} />
        <Stat label="Copies" value={totalCopies} />
        <Stat label="Available" value={available} tone="success" />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "error" : "default"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Catalog">
          <table className="w-full">
            <thead><tr><th className="th">Title</th><th className="th">Author</th><th className="th">Copies</th><th className="th">Available</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="row-hover">
                  <td className="td font-medium">{i.title}</td>
                  <td className="td text-muted">{i.author}</td>
                  <td className="td tabular-nums">{i.copies}</td>
                  <td className="td tabular-nums">{i.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Recent circulation">
          <table className="w-full">
            <thead><tr><th className="th">Item</th><th className="th">Reader</th><th className="th">Due</th><th className="th">Fine</th></tr></thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id} className="row-hover">
                  <td className="td">{l.item.title}</td>
                  <td className="td text-muted">{l.student.user.displayName}</td>
                  <td className="td">
                    {relative(l.dueAt)}
                    {!l.returnedAt && l.dueAt < new Date() && <Tag tone="warning">Overdue</Tag>}
                    {l.returnedAt && <Tag tone="success">Returned</Tag>}
                  </td>
                  <td className="td tabular-nums">{l.fine ? inr(l.fine) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </>
  );
}
