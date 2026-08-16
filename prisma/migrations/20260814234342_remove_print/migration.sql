/*
  Warnings:

  - You are about to drop the `GcodePrintJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrintQueueSubmission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrintRating` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Printer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."GcodePrintJob" DROP CONSTRAINT "GcodePrintJob_printerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GcodePrintJob" DROP CONSTRAINT "GcodePrintJob_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PrintQueueSubmission" DROP CONSTRAINT "PrintQueueSubmission_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PrintRating" DROP CONSTRAINT "PrintRating_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Printer" DROP CONSTRAINT "Printer_createdByUserId_fkey";

-- DropTable
DROP TABLE "public"."GcodePrintJob";

-- DropTable
DROP TABLE "public"."PrintQueueSubmission";

-- DropTable
DROP TABLE "public"."PrintRating";

-- DropTable
DROP TABLE "public"."Printer";

-- DropEnum
DROP TYPE "public"."GcodePrintJobStatus";

-- DropEnum
DROP TYPE "public"."PrintRatingSmiley";

-- DropEnum
DROP TYPE "public"."PrintRatingTag";

-- DropEnum
DROP TYPE "public"."PrinterType";
