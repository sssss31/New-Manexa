"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { enterMarks, gradeSubmission, markAttendance, publishCourse, publishExam } from "@/lib/engine";
import { audit } from "@/lib/audit";

async function actor() {
  return requireRole("TEACHER");
}

export async function markAttendanceAction(formData: FormData) {
  const a = await actor();
  const sectionId = String(formData.get("sectionId"));
  const students = await prisma.student.findMany({ where: { sectionId } });
  const entries = students.map((s) => {
    const status = (formData.get(`s_${s.id}`) as string) || "PRESENT";
    const reason = (formData.get(`r_${s.id}`) as string) || undefined;
    return { studentId: s.id, status: status as any, reason };
  });
  await markAttendance({ tenantId: a.tenantId!, actorId: a.id, entries });
  revalidatePath("/teacher/attendance");
}

export async function createCourseAction(formData: FormData) {
  const a = await actor();
  const c = await prisma.course.create({
    data: {
      tenantId: a.tenantId!,
      subjectId: String(formData.get("subjectId")),
      title: String(formData.get("title")),
      summary: String(formData.get("summary") || ""),
      teacherId: a.id,
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "COURSE_CREATE", entity: "Course", entityId: c.id });
  revalidatePath("/teacher/courses");
}

export async function addLessonAction(formData: FormData) {
  const a = await actor();
  const courseId = String(formData.get("courseId"));
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
  const a = await actor();
  await publishCourse({ tenantId: a.tenantId!, actorId: a.id, courseId: String(formData.get("courseId")) });
  revalidatePath("/teacher/courses");
}

export async function createAssignmentAction(formData: FormData) {
  const a = await actor();
  await prisma.assignment.create({
    data: {
      courseId: String(formData.get("courseId")),
      title: String(formData.get("title")),
      instructions: String(formData.get("instructions")),
      dueAt: new Date(String(formData.get("dueAt"))),
      maxScore: Number(formData.get("maxScore") || 100),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "ASSIGNMENT_CREATE", entity: "Assignment" });
  revalidatePath("/teacher/assignments");
}

export async function gradeAction(formData: FormData) {
  const a = await actor();
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
  const a = await actor();
  await prisma.exam.create({
    data: {
      tenantId: a.tenantId!,
      classId: String(formData.get("classId")),
      subjectId: String(formData.get("subjectId")),
      title: String(formData.get("title")),
      type: String(formData.get("type") || "CLASS_TEST"),
      scheduledAt: new Date(String(formData.get("scheduledAt"))),
      maxScore: Number(formData.get("maxScore") || 100),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "EXAM_CREATE", entity: "Exam" });
  revalidatePath("/teacher/exams");
}

export async function enterMarksAction(formData: FormData) {
  const a = await actor();
  const examId = String(formData.get("examId"));
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return;
  const students = await prisma.student.findMany({ where: { classId: exam.classId } });
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
  const a = await actor();
  await publishExam({ tenantId: a.tenantId!, actorId: a.id, examId: String(formData.get("examId")) });
  revalidatePath("/teacher/exams");
}
