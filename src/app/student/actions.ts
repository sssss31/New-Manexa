"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { submitAssignment } from "@/lib/engine";

export async function submitAssignmentAction(formData: FormData) {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({ where: { userId: user.id } });
  if (!student) return;
  await submitAssignment({
    tenantId: user.tenantId!,
    actorId: user.id,
    assignmentId: String(formData.get("assignmentId")),
    studentId: student.id,
    content: String(formData.get("content")),
  });
  revalidatePath("/student/assignments");
}
