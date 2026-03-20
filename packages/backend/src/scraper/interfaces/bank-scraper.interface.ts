// Public plugin contract — single source of truth lives in @finance-tracker/plugin-sdk.
// All internal backend code that imports from this file continues to work unchanged.
import type {
    PluginInputs, RawTransaction
} from '@finance-tracker/plugin-sdk';
export type {
    BankScraper,
    PluginFieldDescriptor,
    PluginInputs,
    ScrapeOptions,
    RawTransaction
} from '@finance-tracker/plugin-sdk';

/**
 * Input passed to the scraper worker thread via `workerData`.
 * All sensitive values (credentials) are decrypted in the main process
 * before being passed here.
 */
export interface ScraperWorkerInput {
    bankId: string;
    inputs: PluginInputs;
    startDate: string;   // ISO 8601 UTC
    endDate: string;     // ISO 8601 UTC
    accountId: string;
    jobId: string;
    userId: string;
    /** When true the worker skips the final prisma.transaction.createMany call. */
    dryRun: boolean;
    /**
     * Absolute file:// URL to the compiled plugin .js file.
     * Resolved by ScraperService from ScraperRegistry.getPluginPath(bankId).
     * The worker calls dynamic import(pluginPath) to load the BankScraper instance.
     */
    pluginPath: string;
    /**
     * Full DATABASE_URL connection string.
     * Passed to `new PrismaClient({ datasources: { db: { url: databaseUrl } } })`
     * inside the worker so it can write transactions without NestJS DI.
     */
    databaseUrl: string;
}

/**
 * Messages posted by the scraper worker thread to the main process.
 */
export type WorkerMessage =
    | {type: 'status', status: string, message: string}
    | {type: 'mfa_required', prompt: string}
    | {type: 'result', transactions: RawTransaction[], importedCount: number, skippedCount: number};
