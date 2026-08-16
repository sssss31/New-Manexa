import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard, Stat, Tag, EmptyState } from "@/components/ui";
import { relative } from "@/lib/format";
import { DOC_CATEGORIES, DOC_OWNER_TYPES } from "@/lib/ops";
import { createDocumentAction, deleteDocumentAction } from "./actions";

export const dynamic = "force-dynamic";

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const isUrl = (s: string | null) => !!s && /^https?:\/\//i.test(s);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const tenantId = user.tenantId!;
  const sp = await searchParams;

  const docs = await prisma.document.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <>
      <PageHeader title="Document center" sub="A searchable registry of institution records & links" />
      {sp.err && <div className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error" role="alert">{decodeURIComponent(sp.err)}</div>}

      <div className="mb-4 rounded-xl border border-info/25 bg-info/[0.06] px-4 py-2.5 text-xs text-info">
        This is a document <span className="font-medium">registry</span> — it tracks records with a reference (a link or physical location) and notes. File uploads plug in once cloud storage is configured.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Documents" value={docs.length} />
        <Stat label="Policies" value={docs.filter((d) => d.category === "POLICY").length} />
        <Stat label="Contracts" value={docs.filter((d) => d.category === "CONTRACT").length} />
        <Stat label="Certificates" value={docs.filter((d) => d.category === "CERTIFICATE").length} />
      </div>

      {/* Add document */}
      <SectionCard className="mb-6">
        <div className="text-sm font-semibold text-fg mb-3">Add a document</div>
        <form action={createDocumentAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <label className="lg:col-span-2"><span className="label">Title</span><input name="title" required placeholder="e.g. Fee refund policy 2026" className="input" /></label>
          <label><span className="label">Category</span>
            <select name="category" className="select" defaultValue="POLICY">{DOC_CATEGORIES.map((c) => <option key={c} value={c}>{title(c)}</option>)}</select>
          </label>
          <label><span className="label">Owner</span>
            <select name="ownerType" className="select" defaultValue="INSTITUTION">{DOC_OWNER_TYPES.map((c) => <option key={c} value={c}>{title(c)}</option>)}</select>
          </label>
          <label className="lg:col-span-2"><span className="label">Reference (link or location)</span><input name="reference" placeholder="https://…  or  Cabinet 3, File 12" className="input" /></label>
          <label className="lg:col-span-2"><span className="label">Note</span><input name="note" placeholder="Optional" className="input" /></label>
          <div className="lg:col-span-4"><button className="btn-primary">Add document</button></div>
        </form>
      </SectionCard>

      {/* Registry */}
      <SectionCard>
        <div className="text-sm font-semibold text-fg mb-1">Registry</div>
        {docs.length === 0 ? (
          <EmptyState title="No documents yet" sub="Add your first record above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">Title</th><th className="th">Category</th><th className="th">Owner</th><th className="th">Reference</th><th className="th">Added</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="row-hover">
                    <td className="td text-fg">{d.title}{d.note ? <span className="block text-xs text-subtle">{d.note}</span> : null}</td>
                    <td className="td"><Tag>{title(d.category)}</Tag></td>
                    <td className="td text-muted">{title(d.ownerType)}</td>
                    <td className="td text-muted max-w-[220px] truncate">
                      {isUrl(d.reference) ? <a href={d.reference!} target="_blank" rel="noreferrer" className="text-accent hover:underline">Open link ↗</a> : (d.reference || "—")}
                    </td>
                    <td className="td text-muted whitespace-nowrap">{relative(d.createdAt)}</td>
                    <td className="td text-right">
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="btn-ghost text-xs text-error hover:bg-error/10" aria-label="Delete document">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
