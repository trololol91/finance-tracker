/**
 * Scraper worker thread entry point.
 *
 * Runs inside a Node.js worker_thread. Does not use NestJS DI.
 * Communicates exclusively via parentPort.postMessage / parentPort.once('message').
 *
 * MFA bridge:
 *   Worker → main: postMessage({ type: 'mfa_required', prompt })
 *   Main → worker: postMessage({ type: 'mfa_code', code })
 *   Worker: const { code } = await new Promise(r => parentPort.once('message', r))
 */
import {
    parentPort,
    workerData
} from 'worker_threads';
import {chromium} from 'playwright';
import {PrismaClient} from '#generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import type {
    ScraperWorkerInput,
    RawTransaction,
    BankScraper
} from '#scraper/interfaces/bank-scraper.interface.js';
import {MfaRequiredError} from '#scraper/interfaces/bank-scraper.interface.js';
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

const browser = await chromium.launch({headless: true});
const page    = await browser.newPage();

const adapter = new PrismaPg({connectionString: input.databaseUrl});
const prisma = new PrismaClient({adapter});

let importedCount = 0;
let skippedCount  = 0;

try {
    const mod = await import(input.pluginPath) as {default: BankScraper};
    const scraper = mod.default;

    try {
        await scraper.login(page, input.inputs);
    } catch (err) {
        // Use a duck-type check instead of instanceof so this works correctly
        // when vi.resetModules() causes the interface module to be re-evaluated
        // in a different module realm (test environment only; no production impact).
        const isMfaError =
            err instanceof MfaRequiredError ||
            (err instanceof Error && err.name === 'MfaRequiredError' && 'prompt' in err);
        if (!isMfaError) throw err;

        const prompt = (err as MfaRequiredError).prompt;
        parentPort.postMessage({type: 'mfa_required', prompt});
        const {code} = await new Promise<{code: string}>(r =>
            parentPort!.once('message', r)
        );

        if (typeof scraper.submitMfa === 'function') {
            await scraper.submitMfa(page, code);
        }
    }

    const transactions: RawTransaction[] = await scraper.scrapeTransactions(page, {
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        includePending: true
    });

    const syntheticIds = transactions.map(t => t.syntheticId);
    const existing = await prisma.transaction.findMany({
        where: {
            userId: input.userId,
            fitid: {in: syntheticIds}
        },
        select: {fitid: true}
    });
    const existingFitids = new Set(existing.map(r => r.fitid));
    const newTransactions = transactions.filter(
        t => !existingFitids.has(t.syntheticId)
    );

    skippedCount  = transactions.length - newTransactions.length;
    importedCount = newTransactions.length;

    if (!input.dryRun && newTransactions.length > 0) {
        await prisma.transaction.createMany({
            data: newTransactions.map(t => ({
                userId: input.userId,
                accountId: input.accountId,
                fitid: t.syntheticId,
                date: new Date(t.date),
                originalDate: new Date(t.date),
                description: t.description,
                amount: t.amount,
                transactionType: t.amount >= 0 ? 'income' : 'expense',
                isActive: true
            }))
        });
    }

    parentPort.postMessage({
        type: 'result',
        transactions,
        importedCount,
        skippedCount
    });

} finally {
    await prisma.$disconnect();
    await browser.close();
}
