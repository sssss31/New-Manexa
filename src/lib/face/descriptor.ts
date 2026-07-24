// Isomorphic face descriptor contract — shared by the browser capture code and
// the server matcher. No secrets, no node APIs here.
//
// EMBEDDING SOURCE (swap point): today the browser computes a 256-d normalized
// grayscale descriptor from the aligned face crop (works everywhere, no model
// download). In production this file's DESCRIPTOR_DIM + the client embedder are
// replaced by an ArcFace/InsightFace 512-d embedding served from a GPU
// inference microservice (KServe/BentoML, SAD §12.4). The match() interface and
// every table/route below stay identical — only the vector source changes.

export const DESCRIPTOR_DIM = 256; // 16×16 grayscale; ArcFace path uses 512
export const POSES = ["FRONT", "LEFT30", "RIGHT30", "UP", "DOWN", "SMILE", "NEUTRAL"] as const;
export type Pose = (typeof POSES)[number];

export const POSE_GUIDE: Record<Pose, string> = {
  FRONT: "Look straight at the camera",
  LEFT30: "Turn your head ~30° left",
  RIGHT30: "Turn your head ~30° right",
  UP: "Tilt your head slightly up",
  DOWN: "Tilt your head slightly down",
  SMILE: "Face forward and smile",
  NEUTRAL: "Face forward, neutral expression",
};

export interface QualityMetrics {
  brightness: number; // 0-255 mean luma of face region
  sharpness: number; // Laplacian variance (higher = sharper)
  faceCount: number; // detected faces in frame
  faceBoxPx: number; // min(width,height) of face box in px
  centered: boolean; // face near frame center
  frameW: number;
  frameH: number;
}

export interface QualityVerdict {
  ok: boolean;
  score: number; // 0-100 composite
  reasons: string[]; // failing reasons, empty when ok
}

// Server + client agree on these gates so the client can pre-flight and the
// server re-validates (never trust the client).
export const QUALITY = {
  minBrightness: 55,
  maxBrightness: 215,
  minSharpness: 12,
  minFaceBoxPx: 110,
  maxFaces: 1,
  minComposite: 55,
};

export function gradeQuality(m: QualityMetrics): QualityVerdict {
  const reasons: string[] = [];
  if (m.faceCount === 0) reasons.push("No face detected");
  if (m.faceCount > QUALITY.maxFaces) reasons.push("Multiple faces in frame");
  if (m.brightness < QUALITY.minBrightness) reasons.push("Too dark");
  if (m.brightness > QUALITY.maxBrightness) reasons.push("Overexposed");
  if (m.sharpness < QUALITY.minSharpness) reasons.push("Image is blurry");
  if (m.faceBoxPx < QUALITY.minFaceBoxPx) reasons.push("Move closer — face too small");
  if (!m.centered && m.faceCount > 0) reasons.push("Center your face");

  // Composite: brightness sweet-spot + sharpness + face size, each 0-1.
  const bri = 1 - Math.abs(m.brightness - 135) / 135;
  const sharp = Math.min(1, m.sharpness / 45);
  const size = Math.min(1, m.faceBoxPx / 220);
  const score = Math.round(Math.max(0, Math.min(1, bri * 0.35 + sharp * 0.35 + size * 0.3)) * 100);

  return { ok: reasons.length === 0 && score >= QUALITY.minComposite, score, reasons };
}

// L2-normalized cosine similarity in [-1, 1]. For normalized vectors this is
// just the dot product.
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function l2normalize(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}
