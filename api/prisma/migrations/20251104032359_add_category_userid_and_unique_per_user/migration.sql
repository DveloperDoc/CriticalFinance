/*
  Warnings:

  - The `currency` column on the `Account` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[userId,bank,accountType,accountNumber]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[accountId,externalId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountNumber` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountType` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bank` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `holderName` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rutTitular` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('CUENTA_CORRIENTE', 'CUENTA_VISTA', 'CUENTA_AHORRO', 'TARJETA_CREDITO');

-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('CLP', 'USD', 'EUR');

-- DropIndex
DROP INDEX "public"."Category_name_key";

-- AlterTable
ALTER TABLE "public"."Account" ADD COLUMN     "accountNumber" TEXT NOT NULL,
ADD COLUMN     "accountType" "public"."AccountType" NOT NULL,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alias" TEXT,
ADD COLUMN     "bank" TEXT NOT NULL,
ADD COLUMN     "holderName" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "rutTitular" VARCHAR(16) NOT NULL,
DROP COLUMN "currency",
ADD COLUMN     "currency" "public"."Currency" NOT NULL DEFAULT 'CLP';

-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "balanceAfterCents" INTEGER,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "postedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_bank_accountType_accountNumber_key" ON "public"."Account"("userId", "bank", "accountType", "accountNumber");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "public"."Category"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "public"."Category"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_externalId_key" ON "public"."Transaction"("accountId", "externalId");

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
