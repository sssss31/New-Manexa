// Centralized structured logger. Emits single-line JSON to the console, which
// Vercel captures in Function Logs (and any log aggregator can parse). Never
// logs secrets or request bodies. This is what makes production errors
// debuggable instead of a generic "Something went wrong".

type Level = "info" | "warn" | "error";

export interface LogContext {
  route?: string; // e.g. "loginAction", "GET /api/face/analytics"
  userId?: string | null;
  tenantId?: string | null;
  requestId?: string | null;
  [key: string]: unknown;
}

function emit(level: Level, message: string, ctx: LogContext = {}, error?: unknown) {
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    env: process.env.NODE_ENV,
    ...ctx,
  };
  if (error instanceof Error) {
    record.error = error.message;
    record.errorName = error.name;
    if ((error as { code?: string }).code) record.code = (error as { code?: string }).code;
    // Stack in server logs only — never sent to the browser.
    record.stack = error.stack;
  } else if (error !== undefined) {
    record.error = String(error);
  }
  const line = safeStringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

export const logger = {
  info: (message: string, ctx?: LogContext) => emit("info", message, ctx),
  warn: (message: string, ctx?: LogContext) => emit("warn", message, ctx),
  error: (message: string, error?: unknown, ctx?: LogContext) => emit("error", message, ctx, error),
};

// Next.js uses thrown errors for control flow (redirect / notFound). These must
// NEVER be swallowed by a try/catch — re-throw them so navigation still works.
export function isNextControlFlowError(e: unknown): boolean {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

// Detect a database connectivity failure (Prisma) so we can surface a targeted,
// actionable message. P1001 = can't reach DB server (the classic Vercel↔Supabase
// direct-connection / IPv6 issue); P1017 = server closed the connection.
export function isDbConnectionError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code && ["P1000", "P1001", "P1002", "P1008", "P1017", "P2024"].includes(code)) return true;
  const msg = (e as Error)?.message ?? "";
  return /can't reach database server|connection pool|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg);
}
