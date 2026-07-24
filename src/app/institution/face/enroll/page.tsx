import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";

export default async function EnrollIndex({ searchParams }: { searchParams: Promise<{ q?: string; classId?: string }> }) {
  const { q, classId } = await searchParams;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const [classes, students] = await Promise.all([
    prisma.class.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.student.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        deletedAt: null,
        ...(classId ? { classId } : {}),
        ...(q ? { user: { displayName: { contains: q, mode: "insensitive" } } } : {}),
      },
      include: { user: true, class: true, section: true, faceProfile: { include: { _count: { select: { samples: true } } } } },
      orderBy: { rollNo: "asc" },
      take: 60,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Face enrolment"
        sub="Register a student's face samples. Seven poses, quality-checked, encrypted at rest."
        actions={<Link href="/institution/face" className="btn-secondary">← Dashboard</Link>}
      />
      <SectionCard>
        <form method="get" className="flex flex-wrap gap-2 mb-4">
          <input className="input max-w-xs" name="q" defaultValue={q ?? ""} placeholder="Search student…" />
          <select className="select max-w-[180px]" name="classId" defaultValue={classId ?? ""}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-secondary">Filter</button>
        </form>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="th">Student</th>
                <th className="th">Class</th>
                <th className="th">Adm #</th>
                <th className="th">Enrolment</th>
                <th className="th">Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const samples = s.faceProfile?._count.samples ?? 0;
                return (
                  <tr key={s.id} className="row-hover">
                    <td className="td font-medium">{s.user.displayName}</td>
                    <td className="td text-muted">{s.class.name} {s.section.name}</td>
                    <td className="td font-mono text-xs">{s.admissionNo}</td>
                    <td className="td">
                      {samples > 0
                        ? <Tag tone="success">{samples}/7 poses</Tag>
                        : <Tag tone="muted">Not enrolled</Tag>}
                    </td>
                    <td className="td">
                      <Link href={`/institution/face/enroll/${s.id}`} className="badge badge-accent hover:bg-accent/20 transition-colors">
                        {samples > 0 ? "Re-enrol" : "Enrol face"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {students.length === 0 && <div className="text-sm text-muted mt-3">No students matched.</div>}
      </SectionCard>
    </>
  );
}
