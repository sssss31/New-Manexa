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

// Connection-error Prisma codes. P1000 auth failed · P1001 can't reach server
// (the Vercel↔Supabase direct/IPv6 issue) · P1002 timed out · P1010 access denied
// · P1011 TLS error · P1013 bad connection string · P1017 server closed conn ·
// P2024 pool timeout.
const DB_CONN_CODES = ["P1000", "P1001", "P1002", "P1008", "P1010", "P1011", "P1013", "P1017", "P2024"];

/** The Prisma error code from either a known-request error (.code) or an
 *  initialization error (.errorCode) — cold starts throw the latter. */
export function prismaErrorCode(e: unknown): string | undefined {
  const err = e as { code?: string; errorCode?: string };
  return err?.code ?? err?.errorCode;
}

// Detect a DB connectivity failure across BOTH Prisma error shapes:
//  - PrismaClientKnownRequestError → `.code`   (warm instance, query-time)
//  - PrismaClientInitializationError → `.errorCode` (cold start, can't connect)
// Handling both is why err=dbdown vs err=server was intermittent before.
export function isDbConnectionError(e: unknown): boolean {
  const code = prismaErrorCode(e);
  if (code && DB_CONN_CODES.includes(code)) return true;
  const name = (e as { name?: string })?.name ?? (e as object)?.constructor?.name;
  if (name === "PrismaClientInitializationError") return true;
  const msg = (e as Error)?.message ?? "";
  return /can't reach database server|connection pool|timed out|connection.*closed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|self.signed|SSL|TLS/i.test(msg);
}
