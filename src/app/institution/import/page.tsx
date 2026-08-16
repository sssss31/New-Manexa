import { requireRole } from "@/lib/auth";
import { PageHeader, SectionCard } from "@/components/ui";
import { StudentImporter } from "@/components/import/StudentImporter";

export default async function BulkImportPage() {
  await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);

  return (
    <>
      <PageHeader
        title="Bulk Import Center"
        sub="Migrate your existing records into MANEXA in minutes — no manual entry"
      />

      <SectionCard title="Student Import" className="mb-6">
        <StudentImporter />
      </SectionCard>

      <SectionCard title="More importers">
        <p className="text-sm text-muted">
          Teacher, Staff, Parent, Class, Subject and Fee-structure imports run on the same
          validate → preview → transactional-commit engine. They&apos;re rolling out next —
          the Student importer above is fully live today.
        </p>
      </SectionCard>
    </>
  );
}
