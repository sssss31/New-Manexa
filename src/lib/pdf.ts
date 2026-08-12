// Minimal, dependency-free PDF writer (A4 · Helvetica/Helvetica-Bold · WinAnsi).
// Powers server-generated documents (invoices, receipts). Zero deps by design:
// PDF font libraries (pdfkit etc.) break under Next's server bundling because
// their .afm/.ttf assets don't survive webpack resolution — the standard-14
// fonts cover everything these documents need and ship inside every PDF viewer.
//
// Coordinate system: x from the left, y from the TOP of the page (converted to
// PDF's bottom-left space internally). `text()` treats y as the baseline.

export const A4 = { width: 595.28, height: 841.89 } as const;

export type Rgb = [number, number, number];

export type TextOpts = {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  align?: "left" | "right" | "center";
  /** Ellipsize the string so it never renders wider than this (pt). */
  maxWidth?: number;
};

// Helvetica / Helvetica-Bold glyph advance widths (1/1000 em) for chars 32–126,
// from the Adobe standard-14 AFM metrics. Non-ASCII falls back to 556.
// prettier-ignore
const W_REG = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// prettier-ignore
const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Common Unicode punctuation → WinAnsi byte. The rupee sign has no WinAnsi
// slot; callers should pre-format money as "Rs." (see `rs()` below).
const WINANSI: Record<number, number> = {
  0x2013: 0x96, // – en dash
  0x2014: 0x97, // — em dash
  0x2018: 0x91, // ' left single quote
  0x2019: 0x92, // ' right single quote
  0x201c: 0x93, // " left double quote
  0x201d: 0x94, // " right double quote
  0x2022: 0x95, // • bullet
  0x2026: 0x85, // … ellipsis
};

function toWinAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.replace(/₹/g, "Rs.")) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (WINANSI[c] !== undefined) out.push(WINANSI[c]);
    else if (c >= 0xa0 && c <= 0xff) out.push(c); // latin-1 block matches WinAnsi
    else out.push(0x3f); // '?'
  }
  return out;
}

/** INR integer → "Rs. 1,23,456" (the rupee sign has no glyph in standard-14 fonts). */
export function rs(n: number): string {
  const abs = Math.abs(Math.round(n)).toLocaleString("en-IN");
  return `${n < 0 ? "-" : ""}Rs. ${abs}`;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export class PdfDoc {
  private pages: string[] = [];
  private page = -1;

  constructor() {
    this.addPage();
  }

  addPage() {
    this.pages.push("");
    this.page++;
  }

  get pageCount() {
    return this.pages.length;
  }

  private op(cmd: string) {
    this.pages[this.page] += cmd + "\n";
  }

  textWidth(text: string, size: number, bold = false): number {
    const table = bold ? W_BOLD : W_REG;
    let units = 0;
    for (const code of toWinAnsi(text)) {
      units += code >= 32 && code <= 126 ? table[code - 32] : 556;
    }
    return (units / 1000) * size;
  }

  /** Draw text. `y` is the baseline, measured from the top of the page. */
  text(str: string, x: number, y: number, opts: TextOpts = {}) {
    const { size = 10, bold = false, color = [0.09, 0.1, 0.12] as Rgb, align = "left", maxWidth } = opts;
    let s = str;
    if (maxWidth !== undefined && this.textWidth(s, size, bold) > maxWidth) {
      while (s.length > 1 && this.textWidth(s + "…", size, bold) > maxWidth) s = s.slice(0, -1);
      s = s.trimEnd() + "…";
    }
    let tx = x;
    if (align === "right") tx = x - this.textWidth(s, size, bold);
    else if (align === "center") tx = x - this.textWidth(s, size, bold) / 2;

    const escaped = toWinAnsi(s)
      .map((c) => {
        if (c === 0x5c) return "\\\\";
        if (c === 0x28) return "\\(";
        if (c === 0x29) return "\\)";
        if (c < 32 || c > 126) return "\\" + c.toString(8).padStart(3, "0");
        return String.fromCharCode(c);
      })
      .join("");
    const [r, g, b] = color;
    this.op(`BT ${f(r)} ${f(g)} ${f(b)} rg /${bold ? "F2" : "F1"} ${f(size)} Tf ${f(tx)} ${f(A4.height - y)} Td (${escaped}) Tj ET`);
  }

  /** Filled rectangle; `y` is the TOP edge. */
  rect(x: number, y: number, w: number, h: number, color: Rgb) {
    const [r, g, b] = color;
    this.op(`${f(r)} ${f(g)} ${f(b)} rg ${f(x)} ${f(A4.height - y - h)} ${f(w)} ${f(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.75) {
    const [r, g, b] = color;
    this.op(`${f(r)} ${f(g)} ${f(b)} RG ${f(width)} w ${f(x1)} ${f(A4.height - y1)} m ${f(x2)} ${f(A4.height - y2)} l S`);
  }

  /** Assemble the document. Returns raw PDF bytes. */
  finish(): Uint8Array {
    const objects: string[] = [];
    const n = this.pages.length;
    const kids = this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");

    objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
    objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
    for (let i = 0; i < n; i++) {
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`
      );
      const stream = this.pages[i];
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    }

    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${off.toString().padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
