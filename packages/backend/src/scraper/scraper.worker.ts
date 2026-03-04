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
 * In Phase 8 this becomes:
 *   1. launch(chromium)
 *   2. scraper.login(page, input.credentials)
 *   3. [optional MFA bridge]
 *   4. transactions = await scraper.scrapeTransactions(page, options)
 *   5. parentPort.postMessage({ type: 'result', transactions })
 */
const transactions: RawTransaction[] = [];
parentPort.postMessage({type: 'result', transactions});
