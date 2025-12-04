-- AlterTable
ALTER TABLE "Alert" ALTER COLUMN "payload" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Alert_type_idx" ON "Alert"("type");
