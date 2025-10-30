/*
  Warnings:

  - You are about to alter the column `name` on the `Category` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(80)`.
  - You are about to alter the column `merchant` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `description` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(240)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(160)`.

*/
-- AlterTable
ALTER TABLE "public"."Category" ALTER COLUMN "name" SET DATA TYPE VARCHAR(80);

-- AlterTable
ALTER TABLE "public"."Transaction" ALTER COLUMN "merchant" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(240);

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "email" SET DATA TYPE VARCHAR(160);
