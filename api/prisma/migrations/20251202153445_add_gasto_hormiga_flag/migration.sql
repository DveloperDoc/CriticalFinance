-- AlterEnum
ALTER TYPE "public"."AlertType" ADD VALUE 'gasto_hormiga';

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "isGastoHormiga" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Transaction_isGastoHormiga_idx" ON "public"."Transaction"("isGastoHormiga");
