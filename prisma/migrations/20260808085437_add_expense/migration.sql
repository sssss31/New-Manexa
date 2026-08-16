-- CreateTable: institution operating expenses (P&L debit side).
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidVia" TEXT NOT NULL DEFAULT 'CASH',
    "vendor" TEXT,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_tenantId_spentAt_idx" ON "Expense"("tenantId", "spentAt");

-- CreateIndex
CREATE INDEX "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");
