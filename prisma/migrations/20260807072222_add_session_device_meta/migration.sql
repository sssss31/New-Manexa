-- AlterTable: capture device/network fingerprint on each session for the
-- "Active sessions" security screen. All additive; existing rows get defaults.
ALTER TABLE "Session" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
