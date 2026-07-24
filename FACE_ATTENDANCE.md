# MANEXA — AI Face Attendance Module

Production-grade face attendance integrated into the MANEXA monolith, following
the same service-layer / route-thin / tenant-scoped patterns as the rest of the
platform. This document covers all 15 deliverables per feature.

> **Honest compute boundary.** The recognition *architecture* is production-shaped
> and complete: encrypted embeddings, quality gate, liveness gate, gallery match,
> sessions, dedupe, unknowns, audit, notifications, APIs, dashboards. The
> *embedding source* shipped here is a browser-computed 256-d descriptor (real
> pixel math, runs everywhere, no model download) — good enough for demos and
> small cohorts. For the stated **99% / <300 ms** target, swap in ArcFace /
> InsightFace at the single `embed()` / `match()` seam (see §Recognition). Every
> table, route, component and gate stays identical.

## 1. Folder structure

```
src/lib/face/
  crypto.ts        # AES-256-GCM embedding encryption (server-only)
  descriptor.ts    # isomorphic: poses, quality gate, cosine math, dims
  browser.ts       # "use client": camera, FaceDetector, quality, embed, liveness
  engine.ts        # enroll / recognize / sessions / unknowns — the ONLY module that decrypts
  api-guard.ts     # session auth + RBAC + rate-limit for /api/face/*

src/app/api/face/
  register/route.ts     POST   enrol a pose sample
  recognize/route.ts    POST   match a frame → mark attendance
  session/route.ts      POST start · DELETE stop
  reports/route.ts      GET    attendance rows (export)
  analytics/route.ts    GET    dashboard rollups
  unknown/route.ts      GET list · PATCH resolve
  health/route.ts       GET    subsystem liveness/readiness

src/app/institution/face/
  page.tsx  enroll/  reports/  logs/  unknown/  devices/  settings/  actions.ts
src/app/teacher/
  attendance/live/page.tsx   (live session)   face/page.tsx   (self-enrol)

src/components/face/
  FaceCapture.tsx      LiveRecognizer.tsx      AttendanceSession.tsx      UnknownActions.tsx
```

## 2. Components
Server Components for all pages/data; four client islands for the camera:
`FaceCapture` (7-pose enrolment, live quality meter), `LiveRecognizer`
(recognition loop + result card + roster), `AttendanceSession` (session
selector wrapper), `UnknownActions`. All reuse the MANEXA design system
(`card`, `btn-*`, `badge-*`, Sora/Inter, neon-on-black).

## 3. Database schema (7 models, all tenant-scoped, indexed)
`FaceProfile` (1 per student/staff, versioned) · `FaceSample` (encrypted
embedding + pose + quality) · `AttendanceDevice` (WEBCAM/EXTERNAL/CCTV/GATE/BUS)
· `FaceAttendanceSession` (class/section/subject/period/device/threshold) ·
`FaceAttendanceRecord` (`@@unique[session,student]` = dedupe) · `RecognitionLog`
(every decision + latency + liveness) · `UnknownFace` (encrypted descriptor,
never an image). Migration = `prisma db push` / `prisma migrate deploy` (Postgres).

## 4. API endpoints
Register / Recognize / Start / Stop / Reports / Analytics / Unknown (list+resolve)
/ Health — all under `/api/face/*`, Zod-validated, rate-limited, RBAC-guarded.

## 5. Validation
Zod schemas on every route (descriptor length 64–1024, quality object shape,
enums for pose/decision/kind). Server **re-runs** the quality gate on enrol and
recognize — the client's own quality claim is never trusted.

## 6. Business logic
All in `engine.ts`: enrol (upsert profile, replace pose, bump version, roll up
stats), recognize (quality → liveness → gallery match → mark → mirror to classic
`Attendance` → notify parent → audit), session start/stop, unknown resolve.

## 7. Recognition — the swap point
- **Detect**: browser `FaceDetector` (Shape Detection API) when present; graceful
  centered-crop fallback otherwise.
- **Embed** (`browser.ts#embed`): aligned crop → 16×16 grayscale → mean-subtract
  → L2-normalize → 256-d. **Replace with ArcFace/InsightFace** (WASM in-browser
  or POST to a GPU inference service) — return a 512-d vector, bump
  `DESCRIPTOR_DIM`, done.
- **Match** (`engine.ts#loadGallery` + cosine): section-scoped gallery in JS
  (~40–200 vectors, sub-ms). At 100k students, replace with **pgvector / FAISS**
  ANN — same function signature.
- Threshold configurable per session (default cosine 0.88). ArcFace path uses
  ~0.35–0.50 on 512-d.

## 8. Attendance flow
Teacher → Live Attendance → pick class/section/subject/period/device → Start →
students walk past camera → detect → liveness → match ≥ threshold → **Present**
(or **Late** past cutoff) → timestamp → dedupe → parent notified. Recognized
card shows name, class, roll, time, confidence %.

## 9. Unknown handling
Below threshold → `UnknownFace` row (encrypted descriptor only) + `UNKNOWN` log
→ live card shows "Unknown Student". Resolve queue: **Ignore / Retry / Register**.

## 10. Anti-spoofing / liveness
Motion-window analysis (`browser.ts#livenessScore`): rejects a perfectly static
input (held photo/screen) and erratic input; recognize() hard-rejects
`livenessScore < 35` as `SPOOF_REJECTED`. **Production**: dedicated liveness
model (Silent-Face / MiniFAS) + blink + optional IR/depth — plugs in at the same
gate. (Blink/head-movement/depth are the documented upgrade path.)

## 11. Security
AES-256-GCM embeddings (key via `FACE_ENC_KEY`/scrypt; KMS-envelope in prod) ·
embeddings **never** sent to any client (unknown list explicitly omits the
column) · RBAC on every route (`api-guard`) · every enrol/mark/session/resolve
`audit()`-logged with actor + device info + timestamp · `Permissions-Policy:
camera=(self)` (mic/geo disabled) · IP/UA captured at mark time.

## 12. Error handling
Routes fail closed with typed HTTP codes (401/403/404/422/429). Quality/spoof
rejections are logged, not thrown. Client shows inline reasons ("Too dark",
"Move closer", "Spoof rejected"). No partial writes.

## 13. UI
8 pages: Dashboard, Enrolment (list + capture), Live Attendance, Reports (CSV +
print), Recognition Logs, Unknown Faces, Devices, Settings. Dark-only,
responsive, MANEXA components, Framer-Motion micro-interactions.

## 14. Performance
Section-scoped gallery keeps the candidate set tiny · recognition loop is
single-flight (no request pile-up) · client throttles to ~1.4 fps · indexed
queries · capped result sets + pagination. **Scale-out**: Redis-cached
galleries, BullMQ workers for embedding + notification fan-out, pgvector/FAISS
for match, per-camera stateless recognize pods behind the HPA. Multi-tenant
isolation via `tenantId` on every row + every query.

## 15. Testing strategy
- **Unit**: `crypto` round-trip, `gradeQuality` gate matrix, `cosineSimilarity`,
  `livenessScore` bands.
- **Integration/API**: each route — auth (401/403), validation (422), rate-limit
  (429), happy path; enrol→recognize→dedupe→report end-to-end.
- **Recognition accuracy**: labelled pair set → ROC/threshold sweep (swap-in metric).
- **Liveness**: static-photo & replay corpora must score `SPOOF_REJECTED`.
- **Security**: assert embedding column never serialized; tenant-cross access denied.
- CI already runs typecheck + build + full seed (exercises the face path).

## Deployment
Ships in the existing Docker/K8s. Add `FACE_ENC_KEY` to the secret. `/api/face/health`
joins the probe set. The ArcFace inference service deploys as a sidecar/Deployment
with its own HPA (GPU node pool) — the app talks to it over the cluster network.

## Future-ready (same tables, new device `kind`)
CCTV gate attendance, hostel/bus/library/exam attendance, visitor & employee
attendance are all `AttendanceDevice.kind` + a session context — no schema change.
