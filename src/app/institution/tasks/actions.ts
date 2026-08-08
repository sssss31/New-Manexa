"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createTask, setTaskStatus, deleteTask } from "@/lib/ops";
import { isNextControlFlowError } from "@/lib/logger";

const ROLES = ["INSTITUTION_ADMIN", "PRINCIPAL"] as const;

export async function createTaskAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  const due = String(formData.get("dueDate") ?? "");
  try {
    await createTask(user.tenantId!, user.id, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      assigneeId: String(formData.get("assigneeId") ?? ""),
      priority: String(formData.get("priority") ?? "MEDIUM"),
      dueDate: due ? new Date(due) : null,
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect("/institution/tasks?err=" + encodeURIComponent((e as Error).message || "Could not create task"));
  }
  revalidatePath("/institution/tasks");
}

export async function setTaskStatusAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  await setTaskStatus(user.tenantId!, user.id, String(formData.get("id") ?? ""), String(formData.get("status") ?? ""));
  revalidatePath("/institution/tasks");
}

export async function deleteTaskAction(formData: FormData) {
  const user = await requireRole([...ROLES]);
  await deleteTask(user.tenantId!, user.id, String(formData.get("id") ?? ""));
  revalidatePath("/institution/tasks");
}
