-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "academicYear" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'India',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "institutionId" TEXT NOT NULL,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "subscriptionExpiry" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'SCHOOL',
ADD COLUMN     "website" TEXT,
ALTER COLUMN "primaryColor" SET DEFAULT '#B6FF2A';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'LOCAL';

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionCounter" (
    "type" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InstitutionCounter_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "Permission" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginEvent_userId_at_idx" ON "LoginEvent"("userId", "at");

-- CreateIndex
CREATE INDEX "LoginEvent_tenantId_at_idx" ON "LoginEvent"("tenantId", "at");

-- CreateIndex
CREATE INDEX "RolePermission_tenantId_role_idx" ON "RolePermission"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_tenantId_role_permissionKey_key" ON "RolePermission"("tenantId", "role", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_institutionId_key" ON "Tenant"("institutionId");

-- CreateIndex
CREATE INDEX "Tenant_type_status_idx" ON "Tenant"("type", "status");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

