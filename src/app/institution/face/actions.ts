"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

async function actor() {
  return requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
}

export async function createDeviceAction(formData: FormData) {
  const a = await actor();
  await prisma.attendanceDevice.create({
    data: {
      tenantId: a.tenantId!,
      name: String(formData.get("name")),
      kind: String(formData.get("kind") || "WEBCAM"),
      location: String(formData.get("location") || "") || null,
      status: "ONLINE",
      lastSeenAt: new Date(),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "FACE_DEVICE_CREATE", entity: "AttendanceDevice" });
  revalidatePath("/institution/face/devices");
}

export async function toggleDeviceAction(formData: FormData) {
  const a = await actor();
  const id = String(formData.get("id"));
  const d = await prisma.attendanceDevice.findFirst({ where: { id, tenantId: a.tenantId! } });
  if (!d) return;
  const next = d.status === "DISABLED" ? "ONLINE" : "DISABLED";
  await prisma.attendanceDevice.update({ where: { id }, data: { status: next } });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "FACE_DEVICE_TOGGLE", entity: "AttendanceDevice", entityId: id, detail: next });
  revalidatePath("/institution/face/devices");
}

export async function updateSettingsAction(formData: FormData) {
  const a = await actor();
  // Session defaults are applied at session-start; here we persist to the
  // most recent OPEN sessions as a convenience + audit the change.
  const threshold = Number(formData.get("threshold") || 88);
  const lateAfter = Number(formData.get("lateAfterMin") || 10);
  await prisma.faceAttendanceSession.updateMany({
    where: { tenantId: a.tenantId!, status: "OPEN" },
    data: { threshold, lateAfterMin: lateAfter },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "FACE_SETTINGS_UPDATE", entity: "FaceAttendanceSession", detail: `threshold=${threshold} late=${lateAfter}` });
  revalidatePath("/institution/face/settings");
}
