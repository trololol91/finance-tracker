/* v8 ignore file */
/**
 * Scraper worker thread entry point.
 *
 * This script runs inside a Node.js worker_thread; it must not use NestJS DI
 * or access the database directly. Communication is exclusively via
 * `parentPort.postMessage` / `parentPort.once('message')`.
 *
 * Phase 7 stub: real Playwright scraping is deferred to Phase 8.
 * The worker posts a `logging_in` status then immediately returns an empty
 * `RawTransaction[]` result — the full architecture (MFA bridge, timeouts,
 * plugin resolution) is wired and ready for real scrapers.
 *
 * MFA bridge (Phase 8):
 *   Worker → main: `parentPort.postMessage({ type: 'mfa_required', prompt })`
 *   Main → worker: `worker.postMessage({ type: 'mfa_code', code })`
 *   Worker: `const { code } = await new Promise(r => parentPort.once('message', r))`
 */
import {
    parentPort,
    workerData
} from 'worker_threads';
import type {
    ScraperWorkerInput,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';
import {SyncJobStatus} from '#scraper/sync-job-status.js';

const input = workerData as ScraperWorkerInput;

if (!parentPort) {
    throw new Error('scraper.worker must run as a worker_thread');
}

// Post initial status
parentPort.postMessage({
    type: 'status',
    status: SyncJobStatus.loggingIn,
    message: `Connecting to ${input.bankId}...`
});

/**
 * Phase 7 stub: return empty transactions immediately.
 *
 * Phase 8 implementation (replace the two lines below with this block):
 *
 *   import { chromium } from 'playwright';
 *   import { MfaRequiredError } from '#scraper/banks/cibc.scraper.js'; // or plugin registry
 *
 *   const browser = await chromium.launch({ headless: true });
 *   const page    = await browser.newPage();
 *
 *   try {
 *       // 1. Resolve the correct BankScraper for this bankId from ScraperRegistry.
 *       //    (Registry is populated at startup by ScraperModule / plugin-loader.)
 *       const scraper = registry.get(input.bankId);
 *
 *       // 2. Attempt login — throws MfaRequiredError if bank shows OTP screen.
 *       try {
 *           await scraper.login(page, input.credentials);
 *       } catch (err) {
 *           if (!(err instanceof MfaRequiredError)) throw err;
 *
 *           // 3. Signal the main thread and suspend until the user submits the code.
 *           parentPort!.postMessage({ type: 'mfa_required', prompt: err.prompt });
 *           const { code } = await new Promise<{ code: string }>(r =>
 *               parentPort!.once('message', r)
 *           );
 *
 *           // 4. Submit the MFA code — page is still on the OTP screen.
 *           await scraper.submitMfa(page, code);
 *       }
 *
 *       // 5. Scrape — only reached once the session is fully authenticated.
 *       const transactions = await scraper.scrapeTransactions(page, {
 *           startDate:      new Date(input.startDate),
 *           endDate:        new Date(input.endDate),
 *           includePending: true,
 *       });
 *
 *       parentPort!.postMessage({ type: 'result', transactions });
 *   } finally {
 *       await browser.close();
 *   }
 */
// Phase 7 stub: return empty transactions immediately regardless of dryRun.
// Phase 8 will replace this block with the real Playwright + dedup + write logic.
// The dryRun gate belongs around prisma.transaction.createMany — not around the
// scrape itself. See the Phase 8 comment block above for placement.
const transactions: RawTransaction[] = [];
if (!input.dryRun) {
    // Phase 8: prisma.transaction.createMany(dedupedRows) goes here
}
parentPort.postMessage({type: 'result', transactions});
