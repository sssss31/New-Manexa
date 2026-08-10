"use client";

// Browser-side face capture: camera lifecycle, face detection, quality metrics,
// and the 256-d descriptor. Everything here is real pixel math that runs in any
// browser with getUserMedia — no external model download, no CDN (CSP-safe).
//
// SWAP POINT: replace embed() with an ArcFace/InsightFace call (WASM in-browser
// or a POST to the GPU inference service). The QualityMetrics + descriptor
// contract with the server is unchanged.

import { DESCRIPTOR_DIM, l2normalize, type QualityMetrics } from "./descriptor";

// Optional Shape Detection API (Chromium). Gives real face boxes; we degrade
// gracefully to a centered crop when absent.
type DetectedBox = { x: number; y: number; width: number; height: number };
async function detectFaces(canvas: HTMLCanvasElement): Promise<DetectedBox[]> {
  const FD = (globalThis as any).FaceDetector;
  if (!FD) return [];
  try {
    const detector = new FD({ fastMode: true, maxDetectedFaces: 5 });
    const faces = await detector.detect(canvas);
    return faces.map((f: any) => f.boundingBox as DetectedBox);
  } catch {
    return [];
  }
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  // getUserMedia only exists in a secure context (HTTPS or http://localhost).
  // Over a plain-HTTP IP/tunnel it's undefined — surface a clear reason.
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    const err = new Error("Camera needs a secure page — open it over https:// or http://localhost.");
    err.name = "InsecureContextError";
    throw err;
  }
  // Try preferred (light) constraints first, then progressively looser ones so
  // an over-constrained or quirky camera still starts. 640×480 keeps the frame
  // ~4× smaller than 720p → less CPU + latency; a face still spans 150–400px.
  const attempts: MediaStreamConstraints[] = [
    { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 }, facingMode: "user" }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false },
  ];
  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play().catch(() => {});
      return stream;
    } catch (e) {
      lastErr = e;
      // A permission denial won't be fixed by looser constraints — stop now.
      if ((e as Error)?.name === "NotAllowedError") break;
    }
  }
  throw lastErr ?? new Error("Could not start camera");
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export interface Analysis {
  quality: QualityMetrics;
  descriptor: number[];
  box: DetectedBox | null;
}

// One reusable offscreen canvas for the whole session — allocating a fresh
// canvas + 2D context on every frame (~4–5×/sec) churns GC and adds latency.
let _frameCanvas: HTMLCanvasElement | null = null;
let _frameCtx: CanvasRenderingContext2D | null = null;

// Analyse the current video frame: metrics + descriptor from the aligned crop.
export async function analyzeFrame(video: HTMLVideoElement): Promise<Analysis> {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (!_frameCanvas) {
    _frameCanvas = document.createElement("canvas");
    _frameCtx = _frameCanvas.getContext("2d", { willReadFrequently: true });
  }
  const canvas = _frameCanvas;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = _frameCtx!;
  ctx.drawImage(video, 0, 0, w, h);

  const boxes = await detectFaces(canvas);
  const supported = !!(globalThis as any).FaceDetector;
  // Fall back to a centered square if detection is unavailable.
  const box: DetectedBox =
    boxes[0] ?? { x: w * 0.3, y: h * 0.2, width: w * 0.4, height: h * 0.55 };

  const faceBoxPx = Math.round(Math.min(box.width, box.height));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const centered = Math.abs(cx - w / 2) < w * 0.22 && Math.abs(cy - h / 2) < h * 0.22;

  // Crop the face region for brightness/sharpness + descriptor.
  const crop = cropRegion(ctx, box, w, h);
  const brightness = meanLuma(crop);
  const sharpness = laplacianVariance(crop);
  const descriptor = embed(crop);

  return {
    quality: {
      brightness,
      sharpness,
      // When the browser can't detect, report 1 (assume present) so manual
      // capture still works, but the server's size/brightness gates still bite.
      faceCount: supported ? boxes.length : 1,
      faceBoxPx,
      centered,
      frameW: w,
      frameH: h,
    },
    descriptor,
    box: boxes[0] ?? null,
  };
}

interface Gray {
  data: Float32Array; // luma 0-255
  w: number;
  h: number;
}

function cropRegion(ctx: CanvasRenderingContext2D, box: DetectedBox, w: number, h: number): Gray {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const bw = Math.min(w - x, Math.floor(box.width));
  const bh = Math.min(h - y, Math.floor(box.height));
  const img = ctx.getImageData(x, y, Math.max(1, bw), Math.max(1, bh));
  const data = new Float32Array(img.width * img.height);
  for (let i = 0; i < data.length; i++) {
    const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    data[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { data, w: img.width, h: img.height };
}

function meanLuma(gray: Gray): number {
  let sum = 0;
  for (let i = 0; i < gray.data.length; i++) sum += gray.data[i];
  return Math.round(sum / gray.data.length);
}

// Variance of the Laplacian — the classic focus/blur measure.
function laplacianVariance(gray: Gray): number {
  const { data, w, h } = gray;
  if (w < 3 || h < 3) return 0;
  const lap: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      lap.push(v);
    }
  }
  const mean = lap.reduce((a, b) => a + b, 0) / lap.length;
  const varr = lap.reduce((a, b) => a + (b - mean) ** 2, 0) / lap.length;
  return Math.round(varr / 100); // scaled for readable thresholds
}

// Descriptor: downscale the aligned crop to 16×16 grayscale, mean-subtract,
// L2-normalize → 256-d vector. Deterministic and comparable via cosine.
function embed(gray: Gray): number[] {
  const S = Math.sqrt(DESCRIPTOR_DIM) | 0; // 16
  const out = new Array(S * S).fill(0);
  const { data, w, h } = gray;
  for (let ty = 0; ty < S; ty++) {
    for (let tx = 0; tx < S; tx++) {
      const sx0 = Math.floor((tx * w) / S);
      const sx1 = Math.max(sx0 + 1, Math.floor(((tx + 1) * w) / S));
      const sy0 = Math.floor((ty * h) / S);
      const sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * h) / S));
      let sum = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          sum += data[sy * w + sx];
          n++;
        }
      }
      out[ty * S + tx] = n ? sum / n : 0;
    }
  }
  const mean = out.reduce((a, b) => a + b, 0) / out.length;
  return l2normalize(out.map((v) => v - mean));
}

// ---- Liveness: motion score across a short window of descriptors ----
// A held photo is either perfectly static (near-zero motion) or moves as one
// rigid plane. We reward small natural micro-motion, penalise both extremes.
export function livenessScore(window: number[][]): number {
  if (window.length < 3) return 0;
  let totalDelta = 0;
  for (let i = 1; i < window.length; i++) {
    let d = 0;
    const a = window[i], b = window[i - 1];
    for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]);
    totalDelta += d;
  }
  const avg = totalDelta / (window.length - 1);
  // Map avg delta → 0-100 with a natural-motion sweet spot around 0.02-0.25.
  if (avg < 0.006) return 15; // suspiciously static
  if (avg > 0.6) return 40; // erratic
  const score = Math.min(1, avg / 0.25) * 100;
  return Math.round(Math.max(35, Math.min(100, score)));
}
