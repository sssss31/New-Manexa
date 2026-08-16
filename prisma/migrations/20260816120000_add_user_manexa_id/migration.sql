-- AlterTable
ALTER TABLE "User" ADD COLUMN     "manexaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_manexaId_key" ON "User"("manexaId");

