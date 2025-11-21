-- CreateEnum
CREATE TYPE "public"."AlertSource" AS ENUM ('system', 'ml', 'user');

-- CreateEnum
CREATE TYPE "public"."MlLabelSource" AS ENUM ('model', 'manual', 'imported');

-- AlterTable
ALTER TABLE "public"."Account" ADD COLUMN     "availableCreditCents" INTEGER,
ADD COLUMN     "creditLimitCents" INTEGER,
ALTER COLUMN "rutTitular" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Alert" ADD COLUMN     "source" "public"."AlertSource" NOT NULL DEFAULT 'system';

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "features" JSONB,
ADD COLUMN     "mlLabelSource" "public"."MlLabelSource",
ADD COLUMN     "mlModelVersion" TEXT,
ADD COLUMN     "mlPredictedCategoryId" TEXT;

-- CreateTable
CREATE TABLE "public"."SavingsRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "thresholdCents" INTEGER NOT NULL,
    "notifyMarginCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingsRule_userId_accountId_idx" ON "public"."SavingsRule"("userId", "accountId");

-- CreateIndex
CREATE INDEX "Transaction_mlPredictedCategoryId_idx" ON "public"."Transaction"("mlPredictedCategoryId");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_mlPredictedCategoryId_fkey" FOREIGN KEY ("mlPredictedCategoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavingsRule" ADD CONSTRAINT "SavingsRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavingsRule" ADD CONSTRAINT "SavingsRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
