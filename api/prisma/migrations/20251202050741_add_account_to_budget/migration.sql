/*
  Warnings:

  - A unique constraint covering the columns `[userId,accountId,categoryId,period]` on the table `Budget` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountId` to the `Budget` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Budget_userId_categoryId_period_key";

-- AlterTable
ALTER TABLE "public"."Budget" ADD COLUMN     "accountId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Budget_accountId_idx" ON "public"."Budget"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_accountId_categoryId_period_key" ON "public"."Budget"("userId", "accountId", "categoryId", "period");

-- AddForeignKey
ALTER TABLE "public"."Budget" ADD CONSTRAINT "Budget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
