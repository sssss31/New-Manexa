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
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      // Fast path: row exists → atomic increment (concurrent increments
      // serialize on the row and each caller gets a distinct value).
      const updated = await db.sequenceCounter.update({
        where: { tenantId_name: { tenantId, name } },
        data: { next: { increment: 1 } },
      });
      return updated.next - 1;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2025") throw e; // not "record not found" → real error
      // No counter yet — seed it to one past the current max/count.
      try {
        const start = (await seed()) + 1;
        await db.sequenceCounter.create({ data: { tenantId, name, next: start + 1 } });
        return start;
      } catch (e2) {
        // Another request created it first → loop and take the increment path.
        if ((e2 as { code?: string }).code === "P2002") continue;
        throw e2;
      }
    }
  }
  throw new Error(`Could not allocate sequence "${name}" for tenant ${tenantId}`);
}
