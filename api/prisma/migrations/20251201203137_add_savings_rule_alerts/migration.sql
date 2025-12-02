-- CreateEnum
CREATE TYPE "public"."AlertLevel" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterEnum
ALTER TYPE "public"."AlertType" ADD VALUE 'savings_rule_threshold';

-- AlterTable
ALTER TABLE "public"."Alert" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "level" "public"."AlertLevel" NOT NULL DEFAULT 'WARNING',
ADD COLUMN     "message" VARCHAR(240),
ADD COLUMN     "savingsRuleId" TEXT;

-- CreateIndex
CREATE INDEX "Alert_userId_isActive_idx" ON "public"."Alert"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Alert_accountId_idx" ON "public"."Alert"("accountId");

-- CreateIndex
CREATE INDEX "Alert_savingsRuleId_idx" ON "public"."Alert"("savingsRuleId");

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_savingsRuleId_fkey" FOREIGN KEY ("savingsRuleId") REFERENCES "public"."SavingsRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
