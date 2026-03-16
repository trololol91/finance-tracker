-- RedefineTables
ALTER TABLE "sync_schedules" RENAME COLUMN "credentials_enc" TO "plugin_config_enc";
