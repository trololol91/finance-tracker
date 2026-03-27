-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('in', 'out');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transfer_direction" "TransferDirection";
