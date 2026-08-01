// Very small event bus + rule runner. In prod this would be Temporal + Kafka
// consumers per SAD §12; here we fire rules synchronously and record runs.

import { prisma } from "./prisma";
import { logger } from "./logger";

export type DomainEvent =
  | { type: "attendance.absent"; tenantId: string; studentId: string; studentName: string; parentPhone?: string }
  | { type: "fee.invoice.overdue"; tenantId: string; invoiceId: string; number: string; parentPhone?: string }
  | { type: "fee.invoice.paid"; tenantId: string; invoiceId: string; number: string; amount: number }
  | { type: "exam.result.published"; tenantId: string; examId: string; className: string; subject: string }
  | { type: "lead.new"; tenantId: string; leadId: string; parentName: string }
  | { type: "assignment.missed"; tenantId: string; assignmentId: string; studentId: string; studentName: string };

export async function publish(evt: DomainEvent) {
  // Best-effort side-channel: a broken automation must NEVER abort the calling
  // mutation (callers publish AFTER the primary write has committed — a throw
  // here used to 500 the request while e.g. a payment was already recorded).
  try {
    const autos = await prisma.automation.findMany({
      where: { tenantId: evt.tenantId, eventType: evt.type, enabled: true },
    });
    for (const a of autos) {
      const detail = describe(a.action, evt);
      await prisma.automationRun.create({
        data: {
          automationId: a.id,
          triggeredBy: evt.type,
          status: "OK",
          detail,
        },
      });
      await prisma.automation.update({
        where: { id: a.id },
        data: { runsCount: { increment: 1 }, lastRunAt: new Date() },
      });
      await performAction(a.action, evt);
    }
  } catch (err) {
    logger.error("automation publish failed", err, { eventType: evt.type, tenantId: evt.tenantId });
  }
}

function describe(action: string, evt: DomainEvent) {
  return `${action} · ${evt.type}`;
}

async function performAction(action: string, evt: DomainEvent) {
  if (action === "SEND_SMS" || action === "SEND_WHATSAPP") {
    let toName = "";
    let toAddress = "";
    let body = "";
    if (evt.type === "attendance.absent") {
      toName = `Parent of ${evt.studentName}`;
      toAddress = evt.parentPhone ?? "+91XXXXXXXXXX";
      body = `${evt.studentName} is marked absent today. Please contact the class teacher.`;
    } else if (evt.type === "fee.invoice.overdue") {
      toName = "Parent";
      toAddress = evt.parentPhone ?? "+91XXXXXXXXXX";
      body = `Fee invoice ${evt.number} is overdue. Pay online in the parent app.`;
    } else if (evt.type === "fee.invoice.paid") {
      toName = "Parent";
      toAddress = "+91XXXXXXXXXX";
      body = `Payment received against invoice ${evt.number}. Receipt available in the parent app.`;
    } else if (evt.type === "exam.result.published") {
      toName = "Parent";
      toAddress = "+91XXXXXXXXXX";
      body = `Results for ${evt.subject} (${evt.className}) are now published.`;
    } else if (evt.type === "lead.new") {
      toName = evt.parentName;
      toAddress = "+91XXXXXXXXXX";
      body = `Thank you for your interest — a counsellor will call you within 2 hours.`;
    } else if (evt.type === "assignment.missed") {
      toName = evt.studentName;
      toAddress = "+91XXXXXXXXXX";
      body = `You have a pending assignment overdue. Please submit at the earliest.`;
    }
    await prisma.message.create({
      data: {
        tenantId: evt.tenantId,
        channel: action === "SEND_SMS" ? "SMS" : "WHATSAPP",
        toName,
        toAddress,
        template: evt.type,
        body,
        status: "SENT",
      },
    });
  }
  // Other actions (SEND_EMAIL, CREATE_TASK, POST_LEDGER) recorded via AutomationRun above.
}
