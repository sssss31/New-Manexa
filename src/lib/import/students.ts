// Student bulk-import engine. Pure, tenant-scoped, resilient (a bad row is
// reported and skipped — good rows still import), and audited. Reused by the
// /api/institution/import/students/* routes. Other module importers follow the
// same shape.

import { prisma } from "@/lib/prisma";
import { hashPassword, provisionedPassword } from "@/lib/auth";
import { nextSequence } from "@/lib/sequence";
import { assertSeat } from "@/lib/billing";
import { audit } from "@/lib/audit";

// ---- canonical row + smart header mapping ----

export interface StudentRow {
  name: string;
  admissionNo?: string;
  rollNo?: string;
  className: string;
  section?: string;
  gender?: string;
  dob?: string;
  bloodGroup?: string;
  fatherName?: string;
  motherName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  category?: string;
}

// Header synonyms → canonical key. Institutions never match our exact columns.
const SYNONYMS: Record<keyof StudentRow, string[]> = {
  name: ["name", "studentname", "fullname", "student", "studentfullname"],
  admissionNo: ["admissionno", "admissionnumber", "admno", "admissionid", "enrollmentno"],
  rollNo: ["rollno", "roll", "rollnumber"],
  className: ["class", "classname", "grade", "standard", "std", "course", "batch"],
  section: ["section", "sec", "division"],
  gender: ["gender", "sex"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  bloodGroup: ["bloodgroup", "blood"],
  fatherName: ["fathername", "father", "guardianname", "guardian", "parentname"],
  motherName: ["mothername", "mother"],
  phone: ["phone", "mobile", "mobileno", "contact", "contactno", "phonenumber", "parentphone"],
  email: ["email", "emailaddress", "mail", "parentemail"],
  address: ["address", "addr"],
  city: ["city", "town"],
  state: ["state"],
  pincode: ["pincode", "pin", "zip", "zipcode", "postalcode"],
  category: ["category", "caste"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Build a { originalHeader → canonicalKey } map for the uploaded columns. */
export function mapHeaders(headers: string[]): Record<string, keyof StudentRow> {
  const map: Record<string, keyof StudentRow> = {};
  for (const h of headers) {
    const n = norm(h);
    for (const key of Object.keys(SYNONYMS) as (keyof StudentRow)[]) {
      if (SYNONYMS[key].includes(n)) { map[h] = key; break; }
    }
  }
  return map;
}

/** Convert a raw spreadsheet record into a canonical StudentRow. */
export function toStudentRow(raw: Record<string, unknown>, headerMap: Record<string, keyof StudentRow>): StudentRow {
  const row: Partial<StudentRow> = {};
  for (const [orig, key] of Object.entries(headerMap)) {
    const v = raw[orig];
    if (v !== undefined && v !== null && String(v).trim() !== "") row[key] = String(v).trim();
  }
  return { name: "", className: "", ...row } as StudentRow;
}

export function validateRow(r: StudentRow): string[] {
  const errs: string[] = [];
  if (!r.name || r.name.length < 2) errs.push("Missing student name");
  if (!r.className) errs.push("Missing class");
  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) errs.push("Invalid email");
  if (r.gender && !/^(m|male|f|female|o|other)$/i.test(r.gender)) errs.push("Invalid gender");
  return errs;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
function parseDob(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
function normGender(g?: string): string | undefined {
  if (!g) return undefined;
  const c = g[0].toUpperCase();
  return c === "M" ? "MALE" : c === "F" ? "FEMALE" : "OTHER";
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  createdClasses: string[];
  failures: { row: number; name: string; reason: string }[];
}

/**
 * Commit validated student rows for a tenant. Per-row resilient; auto-creates
 * missing classes/sections; generates admission numbers; links parents.
 */
export async function commitStudents(
  tenantId: string,
  actorId: string,
  rows: StudentRow[]
): Promise<ImportResult> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { subdomain: true } });
  if (!tenant) throw new Error("Tenant not found");

  // Seat gate for the whole batch upfront (throws SeatLimitError if over).
  const valid = rows.filter((r) => validateRow(r).length === 0);
  await assertSeat(tenantId, "students", valid.length);

  // Resolve (create if missing) every class + section referenced.
  const classCache = new Map<string, { classId: string; sectionId: string }>();
  const createdClasses: string[] = [];
  async function resolveClassSection(className: string, section: string) {
    const key = `${className.toLowerCase()}|${section.toLowerCase()}`;
    const hit = classCache.get(key);
    if (hit) return hit;
    let cls = await prisma.class.findFirst({ where: { tenantId, name: { equals: className, mode: "insensitive" } } });
    if (!cls) { cls = await prisma.class.create({ data: { tenantId, name: className } }); createdClasses.push(className); }
    let sec = await prisma.section.findFirst({ where: { tenantId, classId: cls.id, name: { equals: section, mode: "insensitive" } } });
    if (!sec) sec = await prisma.section.create({ data: { tenantId, classId: cls.id, name: section, capacity: 60 } });
    const resolved = { classId: cls.id, sectionId: sec.id };
    classCache.set(key, resolved);
    return resolved;
  }

  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, createdClasses: [], failures: [] };
  const pw = await hashPassword(provisionedPassword());

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const errs = validateRow(r);
    if (errs.length) { result.failed++; result.failures.push({ row: i + 2, name: r.name || "—", reason: errs.join("; ") }); continue; }

    try {
      const section = r.section || "A";
      const { classId, sectionId } = await resolveClassSection(r.className, section);

      // Admission number: use the given one (dedupe) or generate the next.
      let admissionNo = r.admissionNo?.trim();
      if (admissionNo) {
        const clash = await prisma.student.findFirst({ where: { tenantId, admissionNo }, select: { id: true } });
        if (clash) { result.skipped++; continue; } // duplicate admission no
      } else {
        const seq = await nextSequence(tenantId, "admission", () => prisma.student.count({ where: { tenantId } }));
        admissionNo = `${new Date().getFullYear()}/${String(seq).padStart(4, "0")}`;
      }

      const admSlug = admissionNo.replace(/[^0-9a-z]+/gi, "-").toLowerCase();
      const studentEmail = r.email || `${slug(r.name) || "student"}.${admSlug}@student.${tenant.subdomain}.test`;

      // Skip if this email already belongs to someone (global unique).
      if (await prisma.user.findUnique({ where: { email: studentEmail }, select: { id: true } })) {
        result.skipped++; continue;
      }

      await prisma.$transaction(async (tx) => {
        const su = await tx.user.create({
          data: { email: studentEmail, displayName: r.name, role: "STUDENT", passwordHash: pw, tenantId },
        });
        const student = await tx.student.create({
          data: {
            tenantId, userId: su.id, admissionNo, rollNo: r.rollNo, classId, sectionId,
            gender: normGender(r.gender), dateOfBirth: parseDob(r.dob), bloodGroup: r.bloodGroup,
            category: r.category, address: [r.address, r.city, r.state, r.pincode].filter(Boolean).join(", ") || undefined,
            status: "ACTIVE",
          },
        });

        // Optional parent account + link.
        const parentName = r.fatherName || r.motherName;
        if (parentName) {
          const parentEmail = `${slug(parentName) || `parent-${admSlug}`}.${admSlug}@parent.${tenant.subdomain}.test`;
          const existingParent = await tx.user.findUnique({ where: { email: parentEmail } });
          const pu = existingParent ?? await tx.user.create({
            data: { email: parentEmail, displayName: parentName, role: "PARENT", passwordHash: pw, phone: r.phone, tenantId },
          });
          const parent = (await tx.parent.findUnique({ where: { userId: pu.id } }))
            ?? (await tx.parent.create({ data: { tenantId, userId: pu.id, relation: "GUARDIAN" } }));
          await tx.parentStudent.create({ data: { parentId: parent.id, studentId: student.id, isPrimary: true } });
        }
      });
      result.imported++;
    } catch (e) {
      result.failed++;
      result.failures.push({ row: i + 2, name: r.name || "—", reason: (e as Error).message?.slice(0, 120) ?? "error" });
    }
  }

  result.createdClasses = createdClasses;
  await audit({
    tenantId, actorId, action: "STUDENT_BULK_IMPORT", entity: "Student",
    detail: `${result.imported} imported · ${result.skipped} skipped · ${result.failed} failed`,
  });
  return result;
}

// ---- template columns (for the downloadable CSV) ----
export const STUDENT_TEMPLATE_HEADERS = [
  "Student Name", "Admission Number", "Roll Number", "Class", "Section", "Gender", "DOB",
  "Blood Group", "Father Name", "Mother Name", "Phone", "Email", "Address", "City", "State",
  "Pincode", "Category",
];
export const STUDENT_TEMPLATE_SAMPLE = [
  "Aarav Sharma", "", "12", "Class V", "A", "Male", "2015-06-14", "O+", "Ravi Sharma",
  "Meena Sharma", "9812345670", "", "12 MG Road", "Pune", "MH", "411001", "General",
];
