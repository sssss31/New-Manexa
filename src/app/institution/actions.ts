"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  admitFromLead,
  advanceLead,
  createLead,
  postNotice,
  runPayroll,
  approvePayroll,
  disbursePayroll,
} from "@/lib/engine";
import { audit } from "@/lib/audit";

async function actor() {
  return requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
}

export async function createLeadAction(formData: FormData) {
  const a = await actor();
  await createLead({
    tenantId: a.tenantId!,
    actorId: a.id,
    parentName: String(formData.get("parentName")),
    studentName: String(formData.get("studentName")),
    gradeInterest: String(formData.get("gradeInterest")),
    phone: String(formData.get("phone")),
    email: String(formData.get("email") || ""),
    source: String(formData.get("source") || "WEBSITE"),
  });
  revalidatePath("/institution/leads");
}

export async function advanceLeadAction(formData: FormData) {
  const a = await actor();
  await advanceLead({
    tenantId: a.tenantId!,
    actorId: a.id,
    leadId: String(formData.get("leadId")),
    toStage: String(formData.get("toStage")),
    note: String(formData.get("note") || ""),
  });
  revalidatePath("/institution/leads");
}

export async function admitLeadAction(formData: FormData) {
  const a = await actor();
  const res = await admitFromLead({
    tenantId: a.tenantId!,
    actorId: a.id,
    leadId: String(formData.get("leadId")),
    classId: String(formData.get("classId")),
    sectionId: String(formData.get("sectionId")),
  });
  revalidatePath("/institution/leads");
  revalidatePath("/institution/students");
  redirect(`/institution/students/${res.student.id}`);
}

export async function createClassAction(formData: FormData) {
  const a = await actor();
  const name = String(formData.get("name")).trim();
  const stream = String(formData.get("stream") || "") || null;
  const cls = await prisma.class.create({ data: { tenantId: a.tenantId!, name, stream } });
  const sections = String(formData.get("sections") || "A")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sname of sections) {
    await prisma.section.create({ data: { tenantId: a.tenantId!, classId: cls.id, name: sname, capacity: 40 } });
  }
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "CLASS_CREATE", entity: "Class", entityId: cls.id, detail: `${name} · ${sections.join(",")}` });
  revalidatePath("/institution/classes");
}

export async function createSubjectAction(formData: FormData) {
  const a = await actor();
  const code = String(formData.get("code")).trim().toUpperCase();
  const name = String(formData.get("name")).trim();
  await prisma.subject.create({ data: { tenantId: a.tenantId!, code, name } });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "SUBJECT_CREATE", entity: "Subject", detail: `${code} · ${name}` });
  revalidatePath("/institution/subjects");
}

export async function postNoticeAction(formData: FormData) {
  const a = await actor();
  await postNotice({
    tenantId: a.tenantId!,
    actorId: a.id,
    title: String(formData.get("title")),
    body: String(formData.get("body")),
    audience: String(formData.get("audience") || "ALL") as any,
  });
  revalidatePath("/institution/notices");
  revalidatePath("/parent");
  revalidatePath("/student");
}

export async function createFeeStructureAction(formData: FormData) {
  const a = await actor();
  await prisma.feeStructure.create({
    data: {
      tenantId: a.tenantId!,
      classId: String(formData.get("classId")),
      name: String(formData.get("name") || "Annual"),
      tuition: Number(formData.get("tuition") || 0),
      transport: Number(formData.get("transport") || 0),
      lab: Number(formData.get("lab") || 0),
      activity: Number(formData.get("activity") || 0),
      exam: Number(formData.get("exam") || 0),
      misc: Number(formData.get("misc") || 0),
      frequency: String(formData.get("frequency") || "MONTHLY"),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "FEE_STRUCTURE_CREATE", entity: "FeeStructure" });
  revalidatePath("/institution/fees");
}

export async function createAutomationAction(formData: FormData) {
  const a = await actor();
  await prisma.automation.create({
    data: {
      tenantId: a.tenantId!,
      name: String(formData.get("name")),
      trigger: "EVENT",
      eventType: String(formData.get("eventType")),
      condition: String(formData.get("condition") || ""),
      action: String(formData.get("action")),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "AUTOMATION_CREATE", entity: "Automation" });
  revalidatePath("/institution/automations");
}

export async function toggleAutomationAction(formData: FormData) {
  const a = await actor();
  const id = String(formData.get("id"));
  const auto = await prisma.automation.findFirst({ where: { id, tenantId: a.tenantId! } });
  if (!auto) return;
  await prisma.automation.update({ where: { id }, data: { enabled: !auto.enabled } });
  revalidatePath("/institution/automations");
}

export async function runPayrollAction(formData: FormData) {
  const a = await actor();
  await runPayroll({ tenantId: a.tenantId!, actorId: a.id, period: String(formData.get("period")) });
  revalidatePath("/accounts/payroll");
  revalidatePath("/institution/staff");
}

export async function approvePayrollAction(formData: FormData) {
  const a = await actor();
  await approvePayroll({ tenantId: a.tenantId!, actorId: a.id, runId: String(formData.get("runId")) });
  revalidatePath("/accounts/payroll");
}

export async function disbursePayrollAction(formData: FormData) {
  const a = await actor();
  await disbursePayroll({ tenantId: a.tenantId!, actorId: a.id, runId: String(formData.get("runId")) });
  revalidatePath("/accounts/payroll");
}

// ---- Hostel ----

export async function allocateHostelAction(formData: FormData) {
  const a = await actor();
  const roomId = String(formData.get("roomId"));
  const studentId = String(formData.get("studentId"));
  const room = await prisma.hostelRoom.findFirst({
    where: { id: roomId, tenantId: a.tenantId! },
    include: { _count: { select: { allocations: true } } },
  });
  if (!room || room._count.allocations >= room.capacity) return;
  await prisma.hostelAllocation.upsert({
    where: { studentId },
    update: { roomId },
    create: { roomId, studentId },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "HOSTEL_ALLOCATE", entity: "HostelAllocation", detail: `${room.block}-${room.number}` });
  revalidatePath("/institution/hostel");
}

export async function createHostelRoomAction(formData: FormData) {
  const a = await actor();
  await prisma.hostelRoom.create({
    data: {
      tenantId: a.tenantId!,
      block: String(formData.get("block")),
      number: String(formData.get("number")),
      capacity: Number(formData.get("capacity") || 4),
      type: String(formData.get("type") || "NON_AC"),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "HOSTEL_ROOM_CREATE", entity: "HostelRoom" });
  revalidatePath("/institution/hostel");
}

// ---- Inventory ----

export async function createInventoryItemAction(formData: FormData) {
  const a = await actor();
  await prisma.inventoryItem.create({
    data: {
      tenantId: a.tenantId!,
      name: String(formData.get("name")),
      category: String(formData.get("category") || "") || null,
      quantity: Number(formData.get("quantity") || 0),
      reorderLevel: Number(formData.get("reorderLevel") || 5),
      unitCost: Number(formData.get("unitCost") || 0),
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "INVENTORY_ITEM_CREATE", entity: "InventoryItem" });
  revalidatePath("/institution/inventory");
}

export async function adjustStockAction(formData: FormData) {
  const a = await actor();
  const itemId = String(formData.get("itemId"));
  const delta = Number(formData.get("delta"));
  const reason = String(formData.get("reason") || "adjustment");
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, tenantId: a.tenantId! } });
  if (!item || !Number.isFinite(delta) || delta === 0) return;
  if (item.quantity + delta < 0) return; // cannot go negative
  await prisma.stockMovement.create({ data: { itemId, delta, reason } });
  await prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: item.quantity + delta } });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "STOCK_ADJUST", entity: "InventoryItem", entityId: itemId, detail: `${delta > 0 ? "+" : ""}${delta} · ${reason}` });
  revalidatePath("/institution/inventory");
}

// ---- Events ----

export async function createEventAction(formData: FormData) {
  const a = await actor();
  const title = String(formData.get("title"));
  const audience = String(formData.get("audience") || "ALL");
  const e = await prisma.event.create({
    data: {
      tenantId: a.tenantId!,
      title,
      description: String(formData.get("description") || "") || null,
      venue: String(formData.get("venue") || "") || null,
      audience,
      startsAt: new Date(String(formData.get("startsAt"))),
    },
  });
  const roleMap: Record<string, string | null> = { PARENTS: "PARENT", STUDENTS: "STUDENT", STAFF: "TEACHER", ALL: null };
  await prisma.notification.create({
    data: {
      tenantId: a.tenantId!,
      role: roleMap[audience] ?? null,
      kind: "event",
      title: `New event — ${title}`,
      body: `Scheduled ${new Date(String(formData.get("startsAt"))).toLocaleDateString("en-IN")}. Check the events calendar.`,
    },
  });
  await audit({ tenantId: a.tenantId!, actorId: a.id, action: "EVENT_CREATE", entity: "Event", entityId: e.id, detail: title });
  revalidatePath("/institution/events");
}
