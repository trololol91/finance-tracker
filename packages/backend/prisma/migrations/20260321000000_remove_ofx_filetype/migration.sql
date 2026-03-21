-- Reclassify any existing OFX import jobs as csv before removing the enum value
UPDATE "import_jobs" SET "file_type" = 'csv' WHERE "file_type" = 'ofx';

-- AlterEnum: remove 'ofx' value from FileType
-- PostgreSQL does not support DROP VALUE on enums directly; rename-and-recreate pattern is used.
ALTER TYPE "FileType" RENAME TO "FileType_old";
CREATE TYPE "FileType" AS ENUM ('csv');
ALTER TABLE "import_jobs" ALTER COLUMN "file_type" TYPE "FileType" USING ("file_type"::text::"FileType");
DROP TYPE "FileType_old";
