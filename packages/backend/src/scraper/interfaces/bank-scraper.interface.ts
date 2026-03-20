/**
 * Every built-in and external scraper satisfies this contract.
 * Built-in scrapers live under `banks/`; external plugins are loaded from `SCRAPER_PLUGIN_DIR`.
 *
 * Note: `page` parameters use `unknown` here so the interface compiles without
 * requiring `playwright` as a dependency. In real scraper implementations,
 * cast `page as import('playwright').Page` inside the method body.
 */

export interface PluginFieldDescriptor {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'select';
    required: boolean;
    hint?: string;
    options?: {value: string, label: string}[];
}

export type PluginInputs = Record<string, string>;

export class MfaRequiredError extends Error {
    constructor(public readonly prompt: string) {
        super(`MFA required: ${prompt}`);
        this.name = 'MfaRequiredError';
    }
}

export interface BankScraper {
    /** Unique key stored in SyncSchedule.bankId — plain string, no enum. */
    readonly bankId: string;
    readonly displayName: string;
    /**
     * true  = MFA required on every run (session expires immediately).
     * false = save Playwright storageState; MFA only needed on session expiry.
     */
    readonly requiresMfaOnEveryRun: boolean;
    /**
     * Maximum calendar days of transaction history the bank UI displays.
     * The scheduler caps the date range so the scraper never navigates beyond this.
     */
    readonly maxLookbackDays: number;
    /**
     * true  — bank UI shows pending/unsettled transactions.
     * false — bank UI only shows posted/settled transactions.
     */
    readonly pendingTransactionsIncluded: boolean;

    /** Describes the fields this plugin requires from the user (username, password, etc.). */
    readonly inputSchema: PluginFieldDescriptor[];

    /** Navigate to the login page and complete authentication. */
    login(inputs: PluginInputs): Promise<void>;

    /**
     * Called by the worker after the main thread delivers an MFA code.
     * `page` is still positioned on the MFA/OTP screen that login() left it on.
     * Only required for banks that use MFA (requiresMfaOnEveryRun: true or session-expiry MFA).
     */
    submitMfa?(code: string): Promise<void>;

    /**
     * Navigate to the transactions page, apply the date range, and return all
     * visible rows as structured data.
     */
    scrapeTransactions(
        inputs: PluginInputs,
        options: ScrapeOptions
    ): Promise<RawTransaction[]>;
}

export interface ScrapeOptions {
    startDate: Date;
    endDate: Date;
    includePending: boolean;
}

/**
 * A single transaction row as read directly from the bank's web UI.
 */
export interface RawTransaction {
    date: string;          // ISO 8601
    description: string;
    amount: number;        // negative = debit, positive = credit
    pending: boolean;
    /**
     * Stable deduplication key computed by the scraper:
     *   sha256(bankId + accountId + date + description + amount.toFixed(2) + String(pending))
     * Stored in Transaction.fitid.
     */
    syntheticId: string;
}

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
