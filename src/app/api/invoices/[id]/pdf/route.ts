// GET /api/invoices/:id/pdf — the invoice as a real, downloadable PDF.
// Access mirrors the printable page via findInvoiceForViewer (tenant-fenced;
// parents/students only their own). Served inline so the browser previews it
// and Print/Save both work from the viewer.
import { getCurrentUser } from "@/lib/auth";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { findInvoiceForViewer } from "@/lib/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const invoice = await findInvoiceForViewer(user, id);
  if (!invoice) return new Response("Not found", { status: 404 });

  const pdf = renderInvoicePdf(invoice);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
