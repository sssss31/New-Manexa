// Race-safe per-tenant sequence numbers (admission no, invoice no, employee
// code, per-section roll no). Backed by SequenceCounter with an ATOMIC
// increment — replaces the old `count()+1`, which produced duplicate numbers
// under concurrent writes (P2002) and replayed numbers after a hard delete.

import { prisma } from "./prisma";
import type { PrismaClient, Prisma } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Return the next value for (tenantId, name), incrementing atomically. On the
 * FIRST call for a counter, it is seeded to `seed()+1` so existing data (rows
 * created before this counter existed) is never re-numbered.
 */
export async function nextSequence(
  tenantId: string,
  name: string,
  seed: () => Promise<number>,
  db: Db = prisma
): Promise<number> {
  const where = { tenantId_name: { tenantId, name } };

  // 1) Ensure the counter row exists, seeded to one past the current max/count.
  //    Idempotent upsert; retried because a concurrent first-insert can P2002.
  for (let attempt = 0; ; attempt++) {
    try {
      await db.sequenceCounter.upsert({
        where,
        update: {}, // no-op if it already exists
        create: { tenantId, name, next: (await seed()) + 1 },
      });
      break;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 5) continue; // lost the create race → row now exists
      throw e;
    }
  }

  // 2) Atomically claim the next value. Concurrent increments serialize on the
  //    row, so every caller gets a distinct, gap-free number.
  const updated = await db.sequenceCounter.update({ where, data: { next: { increment: 1 } } });
  return updated.next - 1;
}
