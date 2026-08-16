-- CreateTable
CREATE TABLE "SequenceCounter" (
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("tenantId","name")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitHit_key_at_idx" ON "RateLimitHit"("key", "at");
