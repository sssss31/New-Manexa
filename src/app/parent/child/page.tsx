import { requireRole } from "@/lib/auth";
import { KV, PageHeader, SectionCard, Tag } from "@/components/ui";
import { loadParentChildren } from "@/lib/parent-data";
import { dateShort } from "@/lib/format";

export default async function ParentChild() {
  const user = await requireRole("PARENT");
  const kids = await loadParentChildren(user.id);
  return (
    <>
      <PageHeader title="My child" sub={`${kids.length} student${kids.length === 1 ? "" : "s"} linked`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kids.map((k) => (
          <SectionCard key={k.id} title={k.user.displayName}>
            <KV k="Admission #" v={k.admissionNo} />
            <KV k="Class · Section" v={`${k.class.name} · ${k.section.name}`} />
            <KV k="Roll" v={k.rollNo ?? "—"} />
            <KV k="Blood group" v={k.bloodGroup ?? "—"} />
            <KV k="Admitted" v={dateShort(k.admittedAt)} />
            <KV k="Transport" v={k.transportAlloc ? `${k.transportAlloc.route.name} · Stop: ${k.transportAlloc.stopName}` : <Tag>Not opted</Tag>} />
          </SectionCard>
        ))}
      </div>
    </>
  );
}
