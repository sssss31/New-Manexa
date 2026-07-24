import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { dateShort } from "@/lib/format";

export default async function StudentsPage() {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const students = await prisma.student.findMany({
    where: { tenantId: user.tenantId!, deletedAt: null },
    include: {
      user: true,
      class: true,
      section: true,
      parents: { include: { parent: { include: { user: true } } } },
    },
    orderBy: { admittedAt: "desc" },
    take: 1000,
  });

  const rows = students.map((s) => ({
    admissionNo: s.admissionNo,
    name: s.user.displayName,
    class: `${s.class.name} ${s.section.name}`,
    roll: s.rollNo ?? "—",
    parent: s.parents[0]?.parent.user.displayName ?? "—",
    admitted: dateShort(s.admittedAt),
    status: s.status,
    _href: `/institution/students/${s.id}`,
  }));

  return (
    <>
      <PageHeader
        title="Student Information System"
        sub={`${students.length} students · sortable, filterable, exportable`}
      />
      <SectionCard>
        <DataTable
          exportName="students"
          searchPlaceholder="Search name, class, parent…"
          columns={[
            { key: "admissionNo", label: "Adm #" },
            { key: "name", label: "Student" },
            { key: "class", label: "Class" },
            { key: "roll", label: "Roll", numeric: true },
            { key: "parent", label: "Parent" },
            { key: "admitted", label: "Admitted" },
            { key: "status", label: "Status" },
          ]}
          rows={rows}
        />
      </SectionCard>
    </>
  );
}
