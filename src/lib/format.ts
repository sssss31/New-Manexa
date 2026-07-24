export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "₹0";
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-IN");
  return `${n < 0 ? "-" : ""}₹${s}`;
}

export function dateShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTimeShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function timeOnly(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function relative(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  const sign = diff >= 0 ? "" : "in ";
  const post = diff >= 0 ? " ago" : "";
  const t = (n: number, unit: string) => `${sign}${n} ${unit}${n === 1 ? "" : "s"}${post}`;
  if (abs < min) return "just now";
  if (abs < hr) return t(Math.round(abs / min), "min");
  if (abs < day) return t(Math.round(abs / hr), "hr");
  if (abs < day * 7) return t(Math.round(abs / day), "day");
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function pct(n: number, of: number): string {
  if (!of) return "0%";
  return `${Math.round((n / of) * 100)}%`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
