export interface PluginFieldDescriptor {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'select';
    required: boolean;
    hint?: string;
    options?: {value: string, label: string}[];
}

export type PluginInputs = Record<string, string>;

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

    /**
     * Navigate to the login page and complete authentication.
     *
     * If the bank presents an MFA/OTP screen during login, call:
     *   const code = await resolveMfa('Enter the code sent to your device');
     * then fill the code and complete the login flow inline.
     *
     * `resolveMfa` is undefined in contexts where MFA is not supported
     * (e.g. admin dry-run test). If MFA is required but no resolver is
     * provided, throw a plain Error so the job fails with a clear message.
     */
    login(inputs: PluginInputs, resolveMfa?: (prompt: string) => Promise<string>): Promise<void>;

    /**
     * Navigate to the transactions page, apply the date range, and return all
     * visible rows as structured data.
     */
    scrapeTransactions(
        inputs: PluginInputs,
        options: ScrapeOptions
    ): Promise<RawTransaction[]>;

    /**
     * Called by the worker and admin service in a `finally` block — guaranteed
     * to run whether the scrape succeeded or failed.
     * Plugins that own a browser (e.g. CIBC) use this to close it.
     * Plugins with no browser resource (e.g. stub) may omit this method.
     */
    cleanup?(): Promise<void>;
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
     *   sha256(bankId + accountId + date + description + amount.toString())
     * pending is intentionally excluded so the same key matches both the
     * pending and cleared versions of a transaction, allowing the worker to
     * update isPending → false rather than inserting a duplicate.
     * Stored in Transaction.fitid.
     */
    syntheticId: string;
}
