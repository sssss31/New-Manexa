"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requirePermission } from "@/lib/auth";
import { enterMarks, gradeSubmission, markAttendance, parseLocalDT, publishCourse, publishExam } from "@/lib/engine";
import { audit } from "@/lib/audit";

async function actor(permission?: string) {
  if (permission) return requirePermission(permission, "TEACHER");
  return requireRole("TEACHER");
}

// Tenant guard: a formData courseId must belong to the caller's tenant —
// Lesson/Assignment carry no tenantId of their own, so an unvalidated id
// would let a teacher inject content into another institution's course.
async function ownedCourse(tenantId: string, courseId: string) {
  const c = await prisma.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true } });
  if (!c) throw new Error("Course not found");
  return c;
}

export async function markAttendanceAction(formData: FormData) {
  const a = await actor("attendance.mark");
  const sectionId = String(formData.get("sectionId"));
  // Tenant-scoped + active-only: an unscoped sectionId used to pull another
  // institution's roster, and withdrawn students were getting marked PRESENT.
  const students = await prisma.student.findMany({
    where: { sectionId, tenantId: a.tenantId!, status: "ACTIVE", deletedAt: null },
  });
  const entries = students.map((s) => {
    const status = (formData.get(`s_${s.id}`) as string) || "PRESENT";
    const reason = (formData.get(`r_${s.id}`) as string) || undefined;
    return { studentId: s.id, status: status as any, reason };
  });
  await markAttendance({ tenantId: a.tenantId!, actorId: a.id, entries });
  revalidatePath("/teacher/attendance");
}

export async function createCourseAction(formData: FormData) {
  const a = await actor("lms.manage");
  const subjectId = String(formData.get("subjectId"));
  // Tenant guard on the foreign key.
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, tenantId: a.tenantId! }, select: { id: true } });
  if (!subject) throw new Error("Subject not found");
  const c = await prisma.course.create({
    data: {
      tenantId: a.tenantId!,
      subjectId,
      title: String(formData.get("title")),
      summary: String(formData.get("summary") || ""),
      teacherId: a.id,
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "COURSE_CREATE", entity: "Course", entityId: c.id });
  revalidatePath("/teacher/courses");
}

export async function addLessonAction(formData: FormData) {
  const a = await actor("lms.manage");
  const courseId = String(formData.get("courseId"));
  await ownedCourse(a.tenantId!, courseId);
  const order = (await prisma.lesson.count({ where: { courseId } })) + 1;
  await prisma.lesson.create({
    data: {
      courseId,
      order,
      title: String(formData.get("title")),
      body: String(formData.get("body")),
      minutes: Number(formData.get("minutes") || 30),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "LESSON_ADD", entity: "Lesson" });
  revalidatePath(`/teacher/courses/${courseId}`);
}

export async function publishCourseAction(formData: FormData) {
  const a = await actor("lms.manage");
  await publishCourse({ tenantId: a.tenantId!, actorId: a.id, courseId: String(formData.get("courseId")) });
  revalidatePath("/teacher/courses");
}

export async function createAssignmentAction(formData: FormData) {
  const a = await actor("homework.manage");
  const courseId = String(formData.get("courseId"));
  await ownedCourse(a.tenantId!, courseId);
  // datetime-local posts a bare local time — parse as IST, reject garbage.
  const dueAt = parseLocalDT(String(formData.get("dueAt")));
  if (!dueAt) throw new Error("Invalid due date/time");
  await prisma.assignment.create({
    data: {
      courseId,
      title: String(formData.get("title")),
      instructions: String(formData.get("instructions")),
      dueAt,
      maxScore: Number(formData.get("maxScore") || 100),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "ASSIGNMENT_CREATE", entity: "Assignment" });
  revalidatePath("/teacher/assignments");
}

export async function gradeAction(formData: FormData) {
  const a = await actor("homework.manage");
  await gradeSubmission({
    tenantId: a.tenantId!,
    actorId: a.id,
    submissionId: String(formData.get("submissionId")),
    score: Number(formData.get("score")),
    feedback: String(formData.get("feedback") || ""),
  });
  revalidatePath("/teacher/assignments");
}

export async function createExamAction(formData: FormData) {
  const a = await actor("exam.manage");
  const classId = String(formData.get("classId"));
  const subjectId = String(formData.get("subjectId"));
  // Tenant guards on both foreign keys — an exam created against another
  // tenant's classId used to leak that class's full student roster.
  const [cls, subject] = await Promise.all([
    prisma.class.findFirst({ where: { id: classId, tenantId: a.tenantId! }, select: { id: true } }),
    prisma.subject.findFirst({ where: { id: subjectId, tenantId: a.tenantId! }, select: { id: true } }),
  ]);
  if (!cls || !subject) throw new Error("Class/subject not found");
  const scheduledAt = parseLocalDT(String(formData.get("scheduledAt")));
  if (!scheduledAt) throw new Error("Invalid exam date/time");
  await prisma.exam.create({
    data: {
      tenantId: a.tenantId!,
      classId,
      subjectId,
      title: String(formData.get("title")),
      type: String(formData.get("type") || "CLASS_TEST"),
      scheduledAt,
      maxScore: Number(formData.get("maxScore") || 100),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "EXAM_CREATE", entity: "Exam" });
  revalidatePath("/teacher/exams");
}

export async function enterMarksAction(formData: FormData) {
  const a = await actor("exam.manage");
  const examId = String(formData.get("examId"));
  // Tenant-scoped exam + roster (both were unscoped → cross-tenant mark writes).
  const exam = await prisma.exam.findFirst({ where: { id: examId, tenantId: a.tenantId! } });
  if (!exam) return;
  const students = await prisma.student.findMany({
    where: { classId: exam.classId, tenantId: a.tenantId!, status: "ACTIVE", deletedAt: null },
  });
  const entries = students
    .map((s) => {
      const raw = formData.get(`m_${s.id}`);
      if (raw === null || String(raw).trim() === "") return null;
      return { studentId: s.id, score: Number(raw) };
    })
    .filter(Boolean) as { studentId: string; score: number }[];
  await enterMarks({ tenantId: a.tenantId!, actorId: a.id, examId, entries });
  revalidatePath(`/teacher/exams/${examId}`);
}

export async function publishExamAction(formData: FormData) {
  const a = await actor("result.publish");
  await publishExam({ tenantId: a.tenantId!, actorId: a.id, examId: String(formData.get("examId")) });
  revalidatePath("/teacher/exams");
}

// ---- Staff leave (self-service) ----
export async function applyLeaveAction(formData: FormData) {
  const a = await requireRole("TEACHER");
  const staff = await prisma.staff.findFirst({ where: { userId: a.id, tenantId: a.tenantId!, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new Error("No active staff record linked to your account");
  const { applyLeave } = await import("@/lib/leave");
  const from = parseLocalDT(String(formData.get("fromDate")) + "T00:00");
  const to = parseLocalDT(String(formData.get("toDate")) + "T00:00");
  if (!from || !to) throw new Error("Invalid dates");
  await applyLeave({
    tenantId: a.tenantId!, staffId: staff.id, actorId: a.id,
    type: String(formData.get("type") || "CASUAL"),
    fromDate: from, toDate: to,
    reason: String(formData.get("reason") || ""),
  });
  revalidatePath("/teacher/leave");
  revalidatePath("/institution/leave");
}
