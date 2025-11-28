/*
  Warnings:

  - A unique constraint covering the columns `[onchainJobId]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "onchainApproveTx" TEXT,
ADD COLUMN     "onchainCreateTx" TEXT,
ADD COLUMN     "onchainJobId" BIGINT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "onchainMintTx" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_onchainJobId_key" ON "Job"("onchainJobId");
