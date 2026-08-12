// Invoice → PDF layout. Pure function over a fully-loaded invoice (items,
// payments, tenant, student) so the API route stays thin. Print documents are
// ink-on-white regardless of app theme (design-system print rule).
import { A4, PdfDoc, rs, type Rgb } from "./pdf";
import { dateShort, dateTimeShort } from "./format";

export type InvoiceForPdf = {
  number: string;
  periodLabel: string;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  discount: number;
  lateFee: number;
  total: number;
  status: string;
  paidAt: Date | null;
  items: { head: string; amount: number }[];
  payments: { amount: number; method: string; reference: string; gatewayTxId: string | null; paidAt: Date }[];
  tenant: { name: string; institutionId: string; city: string | null; state: string | null };
  student: {
    admissionNo: string;
    user: { displayName: string };
    class: { name: string };
    section: { name: string };
  };
};

const INK: Rgb = [0.09, 0.1, 0.12];
const MUTED: Rgb = [0.44, 0.47, 0.51];
const RULE: Rgb = [0.87, 0.89, 0.91];
const FILL: Rgb = [0.955, 0.962, 0.968];
const GREEN: Rgb = [0.13, 0.55, 0.3];
const AMBER: Rgb = [0.72, 0.5, 0.05];
const RED: Rgb = [0.78, 0.21, 0.2];

const M = 48; // page margin
const CW = A4.width - M * 2; // content width
const RIGHT = M + CW;

/** DUE past its due date renders as OVERDUE, matching the app's badges. */
export function effectiveStatus(inv: Pick<InvoiceForPdf, "status" | "dueDate">): string {
  if (inv.status !== "PAID" && new Date(inv.dueDate) < new Date()) return "OVERDUE";
  return inv.status;
}

export function renderInvoicePdf(inv: InvoiceForPdf): Uint8Array {
  const doc = new PdfDoc();
  const status = effectiveStatus(inv);
  const statusColor = status === "PAID" ? GREEN : status === "OVERDUE" ? RED : AMBER;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, inv.total - paid);

  // ---- Header: institution identity left, document identity right ----
  let y = 78;
  doc.text(inv.tenant.name, M, y, { size: 17, bold: true });
  const place = [inv.tenant.city, inv.tenant.state].filter(Boolean).join(", ");
  doc.text([inv.tenant.institutionId, place].filter(Boolean).join(" · "), M, y + 15, { size: 9, color: MUTED });

  doc.text("INVOICE", RIGHT, y - 2, { size: 21, bold: true, color: MUTED, align: "right" });
  doc.text(inv.number, RIGHT, y + 15, { size: 10, align: "right" });
  const chipW = doc.textWidth(status, 8.5, true) + 16;
  doc.rect(RIGHT - chipW, y + 23, chipW, 16, statusColor);
  doc.text(status, RIGHT - chipW / 2, y + 34, { size: 8.5, bold: true, color: [1, 1, 1], align: "center" });

  y = 122;
  doc.line(M, y, RIGHT, y, RULE, 1);

  // ---- Billed-to (left) · invoice meta (right) ----
  y += 24;
  doc.text("BILLED TO", M, y, { size: 7.5, bold: true, color: MUTED });
  doc.text(inv.student.user.displayName, M, y + 16, { size: 11.5, bold: true, maxWidth: 250 });
  doc.text(`Class ${inv.student.class.name} · Section ${inv.student.section.name}`, M, y + 30, { size: 9.5, color: MUTED });
  doc.text(`Admission No: ${inv.student.admissionNo}`, M, y + 43, { size: 9.5, color: MUTED });

  const metaX = M + 300;
  const meta: [string, string][] = [
    ["Period", inv.periodLabel],
    ["Issue date", dateShort(inv.issueDate)],
    ["Due date", dateShort(inv.dueDate)],
    ...(inv.paidAt ? ([["Paid on", dateShort(inv.paidAt)]] as [string, string][]) : []),
  ];
  meta.forEach(([k, v], i) => {
    const my = y + i * 14;
    doc.text(k, metaX, my, { size: 9, color: MUTED });
    doc.text(v, RIGHT, my, { size: 9.5, align: "right" });
  });

  // ---- Items table ----
  y += 72;
  const amountX = RIGHT - 10;
  const drawTableHead = () => {
    doc.rect(M, y - 14, CW, 21, FILL);
    doc.text("#", M + 10, y, { size: 8.5, bold: true, color: MUTED });
    doc.text("PARTICULARS", M + 34, y, { size: 8.5, bold: true, color: MUTED });
    doc.text("AMOUNT", amountX, y, { size: 8.5, bold: true, color: MUTED, align: "right" });
    y += 22;
  };
  drawTableHead();
  inv.items.forEach((it, i) => {
    if (y > A4.height - 170) {
      doc.addPage();
      y = 70;
      drawTableHead();
    }
    doc.text(String(i + 1), M + 10, y, { size: 9.5, color: MUTED });
    doc.text(it.head, M + 34, y, { size: 10, maxWidth: 330 });
    doc.text(rs(it.amount), amountX, y, { size: 10, align: "right" });
    doc.line(M, y + 7, RIGHT, y + 7, RULE, 0.5);
    y += 20;
  });

  // ---- Totals (right-aligned block) ----
  if (y > A4.height - 220) {
    doc.addPage();
    y = 70;
  }
  y += 8;
  const labelX = RIGHT - 190;
  const row = (label: string, value: string, opts?: { bold?: boolean; size?: number; color?: Rgb }) => {
    doc.text(label, labelX, y, { size: opts?.size ?? 9.5, bold: opts?.bold, color: opts?.color ?? MUTED });
    doc.text(value, amountX, y, { size: opts?.size ?? 10, bold: opts?.bold, color: opts?.color ?? INK, align: "right" });
    y += 16;
  };
  row("Subtotal", rs(inv.subtotal));
  if (inv.discount > 0) row("Discount", `- ${rs(inv.discount)}`, { color: GREEN });
  if (inv.lateFee > 0) row("Late fee", rs(inv.lateFee), { color: RED });
  doc.line(labelX, y - 10, RIGHT, y - 10, RULE, 1);
  y += 2;
  row("Total", rs(inv.total), { bold: true, size: 12, color: INK });
  row("Amount paid", rs(paid), { color: paid > 0 ? GREEN : MUTED });
  row("Balance due", rs(balance), { bold: true, color: balance > 0 ? RED : GREEN });

  // ---- Payment history ----
  if (inv.payments.length > 0) {
    y += 14;
    if (y > A4.height - 140) {
      doc.addPage();
      y = 70;
    }
    doc.text("PAYMENTS", M, y, { size: 7.5, bold: true, color: MUTED });
    y += 6;
    doc.line(M, y, RIGHT, y, RULE, 0.5);
    y += 15;
    for (const p of inv.payments) {
      if (y > A4.height - 110) {
        doc.addPage();
        y = 70;
      }
      doc.text(dateTimeShort(p.paidAt), M, y, { size: 9 });
      doc.text(p.method, M + 130, y, { size: 9, color: MUTED });
      doc.text(p.gatewayTxId ?? p.reference, M + 210, y, { size: 8.5, color: MUTED, maxWidth: 180 });
      doc.text(rs(p.amount), amountX, y, { size: 9.5, align: "right" });
      y += 16;
    }
  }

  // ---- Footer (drawn on the last page, after all content) ----
  const footY = A4.height - 42;
  doc.line(M, footY - 12, RIGHT, footY - 12, RULE, 0.5);
  doc.text(
    `Computer-generated invoice · No signature required · Generated ${dateShort(new Date())} · Powered by MANEXA`,
    A4.width / 2,
    footY,
    { size: 7.5, color: MUTED, align: "center" }
  );

  return doc.finish();
}
