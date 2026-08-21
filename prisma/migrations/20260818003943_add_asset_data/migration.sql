-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('CHURCH_USE', 'STORED', 'IN_REPAIR', 'DISPOSED_OF', 'ON_LOAN');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "depreciatedValueCents" INTEGER,
ADD COLUMN     "itemSerial" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "purchasedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ItemStatus" NOT NULL DEFAULT 'STORED',
ADD COLUMN     "warranty" TEXT;
