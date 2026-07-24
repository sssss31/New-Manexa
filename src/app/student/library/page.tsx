import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader, SectionCard, Tag } from "@/components/ui";
import { relative } from "@/lib/format";

export default async function StudentLibrary() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({ where: { userId: user.id } });
  if (!student) return <EmptyState title="Not enrolled" />;
  const [catalog, myLoans] = await Promise.all([
    prisma.libraryItem.findMany({ where: { tenantId: user.tenantId! }, take: 30, orderBy: { title: "asc" } }),
    prisma.libraryLoan.findMany({ where: { studentId: student.id }, include: { item: true }, orderBy: { borrowedAt: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="Library" sub="Catalog + your loans" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={`Catalog · ${catalog.length}`}>
          <table className="w-full">
            <thead><tr><th className="th">Title</th><th className="th">Author</th><th className="th">Availability</th></tr></thead>
            <tbody>
              {catalog.map((i) => (
                <tr key={i.id} className="row-hover">
                  <td className="td">{i.title}</td>
                  <td className="td text-muted">{i.author}</td>
                  <td className="td">
                    {i.available > 0 ? <Tag tone="success">{i.available} / {i.copies}</Tag> : <Tag tone="warning">Waitlist</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title={`My loans · ${myLoans.length}`}>
          <table className="w-full">
            <thead><tr><th className="th">Title</th><th className="th">Due</th><th className="th">Status</th></tr></thead>
            <tbody>
              {myLoans.map((l) => (
                <tr key={l.id} className="row-hover">
                  <td className="td">{l.item.title}</td>
                  <td className="td text-muted">{relative(l.dueAt)}</td>
                  <td className="td">
                    {l.returnedAt ? <Tag tone="success">Returned</Tag> :
                     l.dueAt < new Date() ? <Tag tone="warning">Overdue</Tag> :
                     <Tag tone="info">On loan</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </>
  );
}
