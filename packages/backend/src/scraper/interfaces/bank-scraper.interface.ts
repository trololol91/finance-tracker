/* v8 ignore file */
/**
 * Every built-in and external scraper satisfies this contract.
 * Built-in scrapers live under `banks/`; external plugins are loaded from `SCRAPER_PLUGIN_DIR`.
 *
 * Note: `page` parameters use `unknown` here so the interface compiles without
 * requiring `playwright` as a dependency. In real scraper implementations,
 * cast `page as import('playwright').Page` inside the method body.
 */
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

    /** Navigate to the login page and complete authentication. */
    login(page: unknown, credentials: BankCredentials): Promise<void>;

    /**
     * Navigate to the transactions page, apply the date range, and return all
     * visible rows as structured data.
     */
    scrapeTransactions(page: unknown, options: ScrapeOptions): Promise<RawTransaction[]>;
}

export interface BankCredentials {
    username: string;
    password: string;
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
 * Serialisable scraper metadata returned by GET /scrapers.
 */
export interface ScraperInfo {
    bankId: string;
    displayName: string;
    requiresMfaOnEveryRun: boolean;
    maxLookbackDays: number;
    pendingTransactionsIncluded: boolean;
}

/**
 * Input passed to the scraper worker thread via `workerData`.
 * All sensitive values (credentials) are decrypted in the main process
 * before being passed here. The worker should never touch the database.
 */
export interface ScraperWorkerInput {
    bankId: string;
    credentials: {username: string, password: string};
    startDate: string;   // ISO 8601 UTC
    endDate: string;     // ISO 8601 UTC
    accountId: string;
    jobId: string;
    userId: string;
}

/**
 * Messages posted by the scraper worker thread to the main process.
 */
export type WorkerMessage =
    | {type: 'status', status: string, message: string}
    | {type: 'mfa_required', prompt: string}
    | {type: 'result', transactions: RawTransaction[]};
