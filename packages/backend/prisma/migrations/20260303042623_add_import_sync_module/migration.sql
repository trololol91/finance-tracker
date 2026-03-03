-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('success', 'failed', 'mfa_required');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('csv', 'ofx');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "fitid" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notify_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_push" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'file',
    "filename" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_schedules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "bank_id" TEXT NOT NULL,
    "credentials_enc" TEXT NOT NULL,
    "cron" TEXT NOT NULL DEFAULT '0 8 * * *',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "last_run_status" "SyncRunStatus",
    "last_successful_sync_at" TIMESTAMPTZ,
    "lookback_days" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sync_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sync_schedule_id" UUID NOT NULL,
    "triggered_by" TEXT NOT NULL DEFAULT 'cron',
    "request_start_date" TIMESTAMPTZ,
    "request_end_date" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "mfa_challenge" TEXT,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_user_id_idx" ON "import_jobs"("user_id");

-- CreateIndex
CREATE INDEX "import_jobs_user_id_status_idx" ON "import_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "sync_schedules_user_id_idx" ON "sync_schedules"("user_id");

-- CreateIndex
CREATE INDEX "sync_schedules_user_id_enabled_idx" ON "sync_schedules"("user_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "sync_schedules_user_id_account_id_key" ON "sync_schedules"("user_id", "account_id");

-- CreateIndex
CREATE INDEX "sync_jobs_user_id_idx" ON "sync_jobs"("user_id");

-- CreateIndex
CREATE INDEX "sync_jobs_sync_schedule_id_idx" ON "sync_jobs"("sync_schedule_id");

-- CreateIndex
CREATE INDEX "sync_jobs_user_id_status_idx" ON "sync_jobs"("user_id", "status");

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_schedules" ADD CONSTRAINT "sync_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_schedules" ADD CONSTRAINT "sync_schedules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_sync_schedule_id_fkey" FOREIGN KEY ("sync_schedule_id") REFERENCES "sync_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
