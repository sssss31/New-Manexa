// Biometric template encryption. Embeddings are AES-256-GCM encrypted at rest
// and NEVER leave the server in plaintext. Key is derived from FACE_ENC_KEY
// (or SESSION_SECRET as a dev fallback) with scrypt.
//
// Production: rotate to AWS KMS envelope encryption — swap deriveKey() for a
// KMS Decrypt call and store per-tenant data keys. The wire format below is
// versioned (v1:) so re-encryption is a background migration.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const SECRET = process.env.FACE_ENC_KEY ?? process.env.SESSION_SECRET ?? "manexa-dev-face-key";
const KEY = scryptSync(SECRET, "manexa.face.v1", 32); // 256-bit key

// Pack a Float32 vector into base64 for compact, precision-stable storage.
function packFloats(vec: number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i++) buf.writeFloatLE(vec[i], i * 4);
  return buf;
}
function unpackFloats(buf: Buffer): number[] {
  const out: number[] = [];
  for (let i = 0; i < buf.length; i += 4) out.push(buf.readFloatLE(i));
  return out;
}

export function encryptEmbedding(vec: number[]): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(packFloats(vec)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptEmbedding(payload: string): number[] {
  const [ver, ivB64, tagB64, ctB64] = payload.split(":");
  if (ver !== "v1") throw new Error("Unsupported embedding version");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return unpackFloats(pt);
}
