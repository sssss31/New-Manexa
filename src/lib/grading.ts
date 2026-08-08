// Grading + report cards — computed live from published exam marks. No grades
// are stored; a student's report is aggregated on read from the Mark/Exam data,
// so it always reflects the latest published results. Subject-wise totals →
// grade, overall percentage → grade + GPA, and class rank (over the same
// published set). A CBSE-style 8-band scale; pass mark 33%.
import { prisma } from "./prisma";

export type GradeTone = "success" | "accent" | "warning" | "error";
export type GradeInfo = { grade: string; point: number; tone: GradeTone; pass: boolean };

export const PASS_MARK = 33;

// Descending bands: first whose `min` is met wins.
const SCALE: { min: number; grade: string; point: number; tone: GradeTone }[] = [
  { min: 91, grade: "A+", point: 10, tone: "success" },
  { min: 81, grade: "A", point: 9, tone: "success" },
  { min: 71, grade: "B+", point: 8, tone: "accent" },
  { min: 61, grade: "B", point: 7, tone: "accent" },
  { min: 51, grade: "C", point: 6, tone: "warning" },
  { min: 41, grade: "D", point: 5, tone: "warning" },
  { min: PASS_MARK, grade: "E", point: 4, tone: "warning" },
  { min: 0, grade: "F", point: 0, tone: "error" },
];

export function gradeFor(pct: number): GradeInfo {
  const b = SCALE.find((x) => pct >= x.min) ?? SCALE[SCALE.length - 1];
  return { grade: b.grade, point: b.point, tone: b.tone, pass: pct >= PASS_MARK };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export type SubjectResult = { subjectId: string; name: string; code: string; obtained: number; max: number; pct: number; grade: GradeInfo };
export type ReportCard = {
  student: {
    id: string;
    userId: string;
    tenantId: string;
    name: string;
    admissionNo: string;
    rollNo: string | null;
    className: string;
    tenantName: string;
    institutionId: string;
  };
  subjects: SubjectResult[];
  overall: { obtained: number; max: number; pct: number; grade: GradeInfo; gpa: number };
  rank: number | null;
  classSize: number;
  hasData: boolean;
};

/**
 * Build a student's report card from PUBLISHED exam marks. Rank is computed
 * across the whole class over the same published set. Returns null if the
 * student doesn't exist.
 */
export async function studentReportCard(studentId: string): Promise<ReportCard | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { name: true } },
      user: { select: { displayName: true } },
      tenant: { select: { name: true, institutionId: true } },
    },
  });
  if (!student) return null;

  // Every published mark in the class (drives both this report and the rank).
  const classMarks = await prisma.mark.findMany({
    where: { exam: { classId: student.classId, status: "PUBLISHED" } },
    select: {
      studentId: true,
      score: true,
      exam: { select: { maxScore: true, subjectId: true, subject: { select: { name: true, code: true } } } },
    },
  });

  type SubAgg = { subjectId: string; name: string; code: string; obtained: number; max: number };
  type StuAgg = { obtained: number; max: number; subjects: Map<string, SubAgg> };
  const byStudent = new Map<string, StuAgg>();
  for (const m of classMarks) {
    const a = byStudent.get(m.studentId) ?? { obtained: 0, max: 0, subjects: new Map() };
    a.obtained += m.score;
    a.max += m.exam.maxScore;
    const s = a.subjects.get(m.exam.subjectId) ?? {
      subjectId: m.exam.subjectId,
      name: m.exam.subject.name,
      code: m.exam.subject.code,
      obtained: 0,
      max: 0,
    };
    s.obtained += m.score;
    s.max += m.exam.maxScore;
    a.subjects.set(m.exam.subjectId, s);
    byStudent.set(m.studentId, a);
  }

  // Rank by overall percentage (desc). Ties share the ordinal position.
  const ranking = [...byStudent.entries()]
    .map(([sid, a]) => ({ sid, pct: a.max ? (a.obtained / a.max) * 100 : 0 }))
    .sort((x, y) => y.pct - x.pct);
  const idx = ranking.findIndex((r) => r.sid === studentId);
  const rank = idx >= 0 ? idx + 1 : null;

  const me = byStudent.get(studentId);
  const subjects: SubjectResult[] = me
    ? [...me.subjects.values()]
        .map((s) => {
          const pct = s.max ? (s.obtained / s.max) * 100 : 0;
          return { subjectId: s.subjectId, name: s.name, code: s.code, obtained: s.obtained, max: s.max, pct: round1(pct), grade: gradeFor(pct) };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const obtained = me?.obtained ?? 0;
  const max = me?.max ?? 0;
  const overallPct = max ? (obtained / max) * 100 : 0;
  const gpa = subjects.length ? subjects.reduce((s, x) => s + x.grade.point, 0) / subjects.length : 0;

  return {
    student: {
      id: student.id,
      userId: student.userId,
      tenantId: student.tenantId,
      name: student.user.displayName,
      admissionNo: student.admissionNo,
      rollNo: student.rollNo,
      className: student.class.name,
      tenantName: student.tenant.name,
      institutionId: student.tenant.institutionId,
    },
    subjects,
    overall: { obtained, max, pct: round1(overallPct), grade: gradeFor(overallPct), gpa: Math.round(gpa * 100) / 100 },
    rank,
    classSize: ranking.length,
    hasData: subjects.length > 0,
  };
}
