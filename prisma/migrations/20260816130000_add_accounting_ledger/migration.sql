-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalBalance" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "reference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerAccount_tenantId_type_idx" ON "LedgerAccount"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_tenantId_code_key" ON "LedgerAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_date_idx" ON "JournalEntry"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_source_sourceId_key" ON "JournalEntry"("tenantId", "source", "sourceId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

