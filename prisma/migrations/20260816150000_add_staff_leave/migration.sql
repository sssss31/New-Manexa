-- CreateTable
CREATE TABLE "StaffLeave" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLeave_tenantId_status_idx" ON "StaffLeave"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StaffLeave_staffId_status_idx" ON "StaffLeave"("staffId", "status");

-- AddForeignKey
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

