import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { createExamAction } from "../actions";

export default async function TeacherExamsList() {
  const user = await requireRole("TEACHER");
  const tenantId = user.tenantId!;
  const [exams, classes, subjects] = await Promise.all([
    prisma.exam.findMany({
      where: { tenantId },
      orderBy: { scheduledAt: "desc" },
      include: { class: true, subject: true, marks: true },
      take: 40,
    }),
    prisma.class.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Exams" sub="Class tests → FAs → SAs. Enter marks and publish." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="All exams" className="lg:col-span-2">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Title</th>
                <th className="th">Class</th>
                <th className="th">Subject</th>
                <th className="th">Date</th>
                <th className="th">Marks</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id} className="row-hover">
                  <td className="td">
                    <Link href={`/teacher/exams/${e.id}`} className="font-medium text-fg hover:text-accent">{e.title}</Link>
                    <div className="text-xs text-muted">{e.type}</div>
                  </td>
                  <td className="td">{e.class.name}</td>
                  <td className="td">{e.subject.name}</td>
                  <td className="td text-muted">{dateShort(e.scheduledAt)}</td>
                  <td className="td tabular-nums">{e.marks.length}</td>
                  <td className="td"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Schedule exam">
          <form action={createExamAction} className="space-y-3">
            <div><label className="label">Title</label><input className="input" name="title" required /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Class</label>
                <select className="select" name="classId">
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label">Subject</label>
                <select className="select" name="subjectId">
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="label">Type</label>
                <select className="select" name="type">
                  <option>CLASS_TEST</option><option>FA</option><option>SA</option><option>PRE_BOARD</option><option>ANNUAL</option>
                </select>
              </div>
              <div><label className="label">Max score</label><input className="input" name="maxScore" type="number" defaultValue={100} /></div>
            </div>
            <div><label className="label">Scheduled at</label><input className="input" name="scheduledAt" type="datetime-local" required /></div>
            <button className="btn-primary w-full">Schedule</button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
