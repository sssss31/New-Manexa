// Operations modules — Procurement, Visitor management, Document registry, and
// Tasks. Every mutation is tenant-scoped (app-layer tenancy) and audited. Kept
// as small validated helpers so pages/actions stay thin and the logic is unit-
// testable. Amounts are INR integers.
import { prisma } from "./prisma";
import { audit } from "./audit";

// ── Constant sets ─────────────────────────────────────────────────────────
export const VENDOR_CATEGORIES = ["GENERAL", "IT", "STATIONERY", "FURNITURE", "MAINTENANCE", "FOOD", "TRANSPORT", "SERVICES"] as const;
export const PO_STATUSES = ["DRAFT", "APPROVED", "RECEIVED", "CANCELLED"] as const;
export const DOC_CATEGORIES = ["POLICY", "CONTRACT", "CERTIFICATE", "HR", "STUDENT", "FINANCE", "GENERAL"] as const;
export const DOC_OWNER_TYPES = ["INSTITUTION", "STUDENT", "STAFF"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

const oneOf = <T extends readonly string[]>(set: T, v: string, fallback: T[number]): T[number] =>
  (set as readonly string[]).includes(v) ? (v as T[number]) : fallback;
const clean = (s: unknown) => String(s ?? "").trim();

// ── Procurement ───────────────────────────────────────────────────────────
export async function createVendor(
  tenantId: string,
  actorId: string | null,
  data: { name: string; category?: string; contact?: string; email?: string; phone?: string; gstin?: string },
) {
  const name = clean(data.name);
  if (!name) throw new Error("Vendor name is required");
  const vendor = await prisma.vendor.create({
    data: {
      tenantId,
      name,
      category: oneOf(VENDOR_CATEGORIES, clean(data.category), "GENERAL"),
      contact: clean(data.contact) || null,
      email: clean(data.email) || null,
      phone: clean(data.phone) || null,
      gstin: clean(data.gstin) || null,
    },
  });
  await audit({ tenantId, actorId, action: "VENDOR_CREATED", entity: "Vendor", entityId: vendor.id, detail: name });
  return vendor;
}

export async function createPurchaseOrder(
  tenantId: string,
  actorId: string | null,
  data: { vendorId: string; description: string; amount: number },
) {
  const description = clean(data.description);
  if (!description) throw new Error("Description is required");
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Amount must be a positive number");
  // Vendor must belong to this tenant.
  const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, tenantId }, select: { id: true, name: true } });
  if (!vendor) throw new Error("Select a valid vendor");
  const count = await prisma.purchaseOrder.count({ where: { tenantId } });
  const number = `PO-${String(count + 1).padStart(4, "0")}`;
  const po = await prisma.purchaseOrder.create({
    data: { tenantId, vendorId: vendor.id, number, description, amount: Math.round(data.amount), createdById: actorId },
  });
  await audit({ tenantId, actorId, action: "PO_CREATED", entity: "PurchaseOrder", entityId: po.id, detail: `${number} · ${vendor.name} · ₹${po.amount}` });
  return po;
}

export async function setPurchaseOrderStatus(tenantId: string, actorId: string | null, id: string, status: string): Promise<boolean> {
  const next = oneOf(PO_STATUSES, status, "DRAFT");
  const res = await prisma.purchaseOrder.updateMany({
    where: { id, tenantId },
    data: {
      status: next,
      ...(next === "APPROVED" ? { approvedAt: new Date() } : {}),
      ...(next === "RECEIVED" ? { receivedAt: new Date() } : {}),
    },
  });
  if (res.count > 0) await audit({ tenantId, actorId, action: "PO_STATUS", entity: "PurchaseOrder", entityId: id, detail: next });
  return res.count > 0;
}

// ── Visitor management ────────────────────────────────────────────────────
export async function checkInVisitor(
  tenantId: string,
  actorId: string | null,
  data: { name: string; phone?: string; purpose: string; host?: string },
) {
  const name = clean(data.name);
  const purpose = clean(data.purpose);
  if (!name) throw new Error("Visitor name is required");
  if (!purpose) throw new Error("Purpose is required");
  const count = await prisma.visitor.count({ where: { tenantId } });
  const passNo = `V-${String(count + 1).padStart(4, "0")}`;
  const visitor = await prisma.visitor.create({
    data: { tenantId, name, phone: clean(data.phone) || null, purpose, host: clean(data.host) || null, passNo, createdById: actorId },
  });
  await audit({ tenantId, actorId, action: "VISITOR_CHECKIN", entity: "Visitor", entityId: visitor.id, detail: `${passNo} · ${name}` });
  return visitor;
}

export async function checkOutVisitor(tenantId: string, actorId: string | null, id: string): Promise<boolean> {
  const res = await prisma.visitor.updateMany({ where: { id, tenantId, status: "IN" }, data: { status: "OUT", checkOutAt: new Date() } });
  if (res.count > 0) await audit({ tenantId, actorId, action: "VISITOR_CHECKOUT", entity: "Visitor", entityId: id });
  return res.count > 0;
}

// ── Document registry ─────────────────────────────────────────────────────
export async function createDocument(
  tenantId: string,
  actorId: string | null,
  data: { title: string; category?: string; ownerType?: string; reference?: string; note?: string },
) {
  const title = clean(data.title);
  if (!title) throw new Error("Title is required");
  const doc = await prisma.document.create({
    data: {
      tenantId,
      title,
      category: oneOf(DOC_CATEGORIES, clean(data.category), "GENERAL"),
      ownerType: oneOf(DOC_OWNER_TYPES, clean(data.ownerType), "INSTITUTION"),
      reference: clean(data.reference) || null,
      note: clean(data.note) || null,
      uploadedById: actorId,
    },
  });
  await audit({ tenantId, actorId, action: "DOCUMENT_ADDED", entity: "Document", entityId: doc.id, detail: title });
  return doc;
}

export async function deleteDocument(tenantId: string, actorId: string | null, id: string): Promise<boolean> {
  const res = await prisma.document.deleteMany({ where: { id, tenantId } });
  if (res.count > 0) await audit({ tenantId, actorId, action: "DOCUMENT_DELETED", entity: "Document", entityId: id });
  return res.count > 0;
}

// ── Tasks ─────────────────────────────────────────────────────────────────
export async function createTask(
  tenantId: string,
  actorId: string | null,
  data: { title: string; description?: string; assigneeId?: string; priority?: string; dueDate?: Date | null },
) {
  const title = clean(data.title);
  if (!title) throw new Error("Task title is required");
  // Assignee, if given, must be a user in this tenant.
  let assigneeId: string | null = null;
  if (clean(data.assigneeId)) {
    const u = await prisma.user.findFirst({ where: { id: data.assigneeId, tenantId }, select: { id: true } });
    assigneeId = u?.id ?? null;
  }
  const task = await prisma.task.create({
    data: {
      tenantId,
      title,
      description: clean(data.description) || null,
      assigneeId,
      priority: oneOf(TASK_PRIORITIES, clean(data.priority), "MEDIUM"),
      dueDate: data.dueDate ?? null,
      createdById: actorId,
    },
  });
  await audit({ tenantId, actorId, action: "TASK_CREATED", entity: "Task", entityId: task.id, detail: title });
  return task;
}

export async function setTaskStatus(tenantId: string, actorId: string | null, id: string, status: string): Promise<boolean> {
  const next = oneOf(TASK_STATUSES, status, "TODO");
  const res = await prisma.task.updateMany({ where: { id, tenantId }, data: { status: next } });
  if (res.count > 0) await audit({ tenantId, actorId, action: "TASK_STATUS", entity: "Task", entityId: id, detail: next });
  return res.count > 0;
}

export async function deleteTask(tenantId: string, actorId: string | null, id: string): Promise<boolean> {
  const res = await prisma.task.deleteMany({ where: { id, tenantId } });
  if (res.count > 0) await audit({ tenantId, actorId, action: "TASK_DELETED", entity: "Task", entityId: id });
  return res.count > 0;
}
