import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { dateShort } from "@/lib/format";

export default async function CertificatePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type = "bonafide" } = await searchParams;
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const student = await prisma.student.findFirst({
    where: { id, tenantId: user.tenantId! },
    include: { user: true, class: true, section: true, tenant: true, parents: { include: { parent: { include: { user: true } } } } },
  });
  if (!student) notFound();
  const t = student.tenant;
  const today = dateShort(new Date());
  const refNo = `${t.code}/CERT/${new Date().getFullYear()}/${student.admissionNo.split("/")[1]}`;

  if (type === "idcard") {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-[340px] rounded-2xl overflow-hidden border border-border bg-card print:border-black">
          <div className="bg-black px-5 py-3 flex items-center justify-between">
            <div>
              <div className="text-accent font-semibold tracking-tight">{t.name}</div>
              <div className="text-[10px] text-muted uppercase tracking-widest">Student Identity Card</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-fg font-bold text-xs">
              {t.code}
            </div>
          </div>
          <div className="p-5 flex gap-4">
            <div className="w-20 h-24 rounded-xl bg-elevated border border-border flex items-center justify-center text-2xl font-semibold text-accent">
              {student.user.displayName.split(" ").slice(0, 2).map((s) => s[0]).join("")}
            </div>
            <div className="text-sm space-y-1">
              <div className="text-fg font-semibold text-base">{student.user.displayName}</div>
              <div className="text-muted">{student.class.name} · Sec {student.section.name}</div>
              <div className="text-muted font-mono text-xs">Adm {student.admissionNo}</div>
              <div className="text-muted text-xs">Blood group: {student.bloodGroup ?? "—"}</div>
              <div className="text-muted text-xs">Valid AY {new Date().getFullYear()}–{new Date().getFullYear() + 1}</div>
            </div>
          </div>
          <div className="px-5 pb-4 flex items-center justify-between">
            <div className="w-14 h-14 rounded-lg border border-border grid grid-cols-4 gap-0.5 p-1" aria-label="QR verification stub">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={`rounded-[1px] ${[0,2,3,5,6,9,10,12,15].includes(i) ? "bg-accent" : "bg-elevated"}`} />
              ))}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-subtle">Principal&apos;s signature</div>
              <div className="mt-4 border-t border-border w-28" />
            </div>
          </div>
        </div>
        <PrintButton label="Print ID card" />
      </div>
    );
  }

  const bodyText =
    type === "character"
      ? `This is to certify that ${student.user.displayName}, Admission No. ${student.admissionNo}, is a student of ${student.class.name} (Section ${student.section.name}) at ${t.name}. During their time at the institution, they have borne a good moral character and have not been involved in any act of indiscipline. We wish them success in all future endeavours.`
      : `This is to certify that ${student.user.displayName}, Admission No. ${student.admissionNo}, is a bonafide student of ${t.name}, currently studying in ${student.class.name} (Section ${student.section.name}) for the academic year ${new Date().getFullYear()}–${new Date().getFullYear() + 1}. This certificate is issued upon request of the parent/guardian for official purposes.`;

  return (
    <div className="min-h-screen bg-bg p-8 flex flex-col items-center gap-6">
      <div className="w-full max-w-2xl bg-white text-black rounded-2xl p-12 border border-border shadow-xl print:shadow-none print:border-0">
        <div className="text-center border-b-2 border-black pb-6">
          <div className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-sora)" }}>{t.name}</div>
          <div className="text-xs uppercase tracking-widest mt-1 text-neutral-600">
            {t.board ?? "CBSE"} Affiliated · {t.subdomain}.manexa.in
          </div>
        </div>
        <div className="flex justify-between text-xs text-neutral-600 mt-6 font-mono">
          <span>Ref: {refNo}</span>
          <span>Date: {today}</span>
        </div>
        <h1 className="text-center text-xl font-bold underline underline-offset-4 mt-8 uppercase tracking-wide">
          {type === "character" ? "Character Certificate" : "Bonafide Certificate"}
        </h1>
        <p className="mt-8 text-[15px] leading-8 text-justify">{bodyText}</p>
        <div className="mt-16 flex justify-between items-end">
          <div className="text-xs text-neutral-500">
            Generated by MANEXA · verify at manexa.in/verify/{refNo.toLowerCase().replace(/\//g, "-")}
          </div>
          <div className="text-center">
            <div className="border-t border-black w-40 mb-1" />
            <div className="text-sm font-medium">Principal</div>
          </div>
        </div>
      </div>
      <PrintButton />
    </div>
  );
}
