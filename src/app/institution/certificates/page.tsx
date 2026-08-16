import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Tag } from "@/components/ui";

const TYPES = [
  { key: "bonafide", label: "Bonafide Certificate", detail: "Confirms current enrolment — banks, passports, visas" },
  { key: "character", label: "Character Certificate", detail: "Conduct attestation for transfers and admissions" },
  { key: "idcard", label: "Student ID Card", detail: "Print-ready card with QR verification stub" },
];

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const students = await prisma.student.findMany({
    where: {
      tenantId: user.tenantId!,
      status: "ACTIVE",
      ...(q ? { user: { displayName: { contains: q } } } : {}),
    },
    include: { user: true, class: true, section: true },
    orderBy: { admittedAt: "desc" },
    take: 20,
  });

  return (
    <>
      <PageHeader title="Certificates & ID cards" sub="Generate print-ready documents — QR-verifiable in production via docvault-svc" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {TYPES.map((t) => (
          <div key={t.key} className="card p-4">
            <div className="text-fg font-medium">{t.label}</div>
            <div className="text-xs text-muted mt-1">{t.detail}</div>
          </div>
        ))}
      </div>

      <SectionCard title="Pick a student">
        <form method="get" className="flex gap-2 mb-4">
          <input className="input max-w-sm" name="q" defaultValue={q ?? ""} placeholder="Search student by name…" />
          <button className="btn-secondary">Search</button>
        </form>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="th">Student</th>
                <th className="th">Class</th>
                <th className="th">Adm #</th>
                <th className="th">Generate</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="row-hover">
                  <td className="td font-medium">{s.user.displayName}</td>
                  <td className="td text-muted">{s.class.name} {s.section.name}</td>
                  <td className="td font-mono text-xs">{s.admissionNo}</td>
                  <td className="td">
                    <div className="flex gap-1.5 flex-wrap">
                      {TYPES.map((t) => (
                        <Link key={t.key} href={`/print/certificate/${s.id}?type=${t.key}`} className="badge badge-accent hover:bg-accent/20 transition-colors">
                          {t.key === "idcard" ? "ID card" : t.label.split(" ")[0]}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {students.length === 0 && <div className="text-sm text-muted mt-3">No students matched.</div>}
        <div className="mt-3"><Tag>Opens a print-ready page — use the browser&apos;s Save as PDF</Tag></div>
      </SectionCard>
    </>
  );
}
