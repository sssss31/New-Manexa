import { NextResponse, NextRequest } from "next/server";

const isProd = process.env.NODE_ENV === "production";

// Defense-in-depth headers (SAD §8). CSP allows inline styles for Tailwind's
// generated rules and dev-mode eval for React Refresh.
// Razorpay checkout loads a script + opens iframes + calls its API. These
// allowlist entries are harmless when online payments are disabled.
const RZP_SCRIPT = "https://checkout.razorpay.com";
const RZP_FRAME = "https://api.razorpay.com https://checkout.razorpay.com";
const RZP_CONNECT = "https://api.razorpay.com https://*.razorpay.com https://lumberjack.razorpay.com";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${RZP_SCRIPT}${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.razorpay.com",
  "font-src 'self' data:",
  `connect-src 'self' ${RZP_CONNECT}${isProd ? "" : " ws:"}`,
  `frame-src 'self' ${RZP_FRAME}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function middleware(req: NextRequest) {
  // x-pathname must ride the REQUEST headers — server components read it via
  // headers(). Setting it only on the response left the value client-spoofable.
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Face attendance needs same-origin camera access; mic/geo stay disabled.
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  if (isProd) {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
