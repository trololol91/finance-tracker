import {Module} from '@nestjs/common';
import {ScheduleModule} from '@nestjs/schedule';
import {DatabaseModule} from '#database/database.module.js';
import {PushModule} from '#push/push.module.js';
import {AdminGuard} from '#common/guards/admin.guard.js';
import {ImportController} from '#scraper/import/import.controller.js';
import {ImportService} from '#scraper/import/import.service.js';
import {SyncScheduleController} from '#scraper/sync/sync-schedule.controller.js';
import {SyncScheduleService} from '#scraper/sync/sync-schedule.service.js';
import {SyncJobController} from '#scraper/sync/sync-job.controller.js';
import {ScraperController} from '#scraper/scraper.controller.js';
import {ScraperAdminController} from '#scraper/scraper-admin.controller.js';
import {ScraperAdminService} from '#scraper/scraper-admin.service.js';
import {ScraperService} from '#scraper/scraper.service.js';
import {ScraperScheduler} from '#scraper/scraper.scheduler.js';
import {ScraperPluginLoader} from '#scraper/scraper.plugin-loader.js';
import {
    ScraperRegistry,
    BANK_SCRAPER
} from '#scraper/scraper.registry.js';
import {CryptoService} from '#scraper/crypto/crypto.service.js';
import {SyncSessionStore} from '#scraper/sync-session.store.js';
import {CibcScraper} from '#scraper/banks/cibc.scraper.js';
import {TdScraper} from '#scraper/banks/td.scraper.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';

/**
 * ScraperModule bundles the transaction import and automated sync features.
 *
 * Controllers:
 *   - ImportController       — POST /import-jobs (file upload + parse)
 *   - SyncScheduleController — CRUD for SyncSchedule
 *   - SyncJobController      — POST /run-now, GET /stream, POST /mfa-response
 *   - ScraperController       — GET /scrapers (public)
 *   - ScraperAdminController   — POST /admin/scrapers/reload, POST /admin/scrapers/install (ADMIN)
 *
 * Providers:
 *   - ImportService, SyncScheduleService, ScraperService, ScraperAdminService
 *   - AdminGuard, ScraperRegistry
 *   - ScraperScheduler (OnModuleInit — restores enabled cron jobs after restart)
 *   - ScraperPluginLoader (OnModuleInit — loads external .js plugins from SCRAPER_PLUGIN_DIR)
 *   - CryptoService (AES-256-GCM credential encryption)
 *   - SyncSessionStore (in-memory SSE sessions)
 *   - BANK_SCRAPER token: array of [CibcScraper, TdScraper] via factory provider
 */
@Module({
    imports: [
        DatabaseModule,
        PushModule,
        ScheduleModule.forRoot()
    ],
    controllers: [
        ImportController,
        SyncScheduleController,
        SyncJobController,
        ScraperController,
        ScraperAdminController
    ],
    providers: [
        ImportService,
        SyncScheduleService,
        ScraperService,
        ScraperAdminService,
        AdminGuard,
        ScraperScheduler,
        ScraperPluginLoader,
        ScraperRegistry,
        CryptoService,
        SyncSessionStore,
        CibcScraper,
        TdScraper,
        {
            provide: BANK_SCRAPER,
            useFactory: (cibc: CibcScraper, td: TdScraper): BankScraper[] => [cibc, td],
            inject: [CibcScraper, TdScraper]
        }
    ]
})
export class ScraperModule {}
