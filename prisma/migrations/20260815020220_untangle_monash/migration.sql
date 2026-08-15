/*
  Warnings:

  - You are about to drop the column `discordId` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `studentNumber` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."user_studentNumber_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "discordId",
DROP COLUMN "studentNumber";
