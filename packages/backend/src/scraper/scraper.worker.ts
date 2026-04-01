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
import {PrismaClient} from '#generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import type {
    ScraperWorkerInput,
    RawTransaction,
    BankScraper
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

const adapter = new PrismaPg({connectionString: input.databaseUrl});
const prisma = new PrismaClient({adapter});

let importedCount = 0;
let skippedCount  = 0;
let scraper: BankScraper | undefined;

try {
    const mod = await import(input.pluginPath) as {default: BankScraper};
    scraper = mod.default;

    const resolver = (prompt: string): Promise<string> => {
        parentPort!.postMessage({type: 'mfa_required', prompt});
        return new Promise<string>((resolve, reject) =>
            parentPort!.once('message', (msg: {type: string, code?: string}) => {
                if (msg.type === 'mfa_cancel') {
                    reject(new Error('MFA cancelled by user'));
                } else {
                    resolve(msg.code ?? '');
                }
            })
        );
    };

    await scraper.login(input.inputs, resolver);

    const transactions: RawTransaction[] = await scraper.scrapeTransactions(
        input.inputs, 
        {
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            includePending: true
        }
    );

    const syntheticIds = transactions.map(t => t.syntheticId);
    const existing = await prisma.transaction.findMany({
        where: {
            userId: input.userId,
            fitid: {in: syntheticIds}
        },
        select: {fitid: true, isPending: true}
    });
    const existingByFitid = new Map(existing.map(r => [r.fitid, r]));

    const toInsert: RawTransaction[] = [];
    const toClearFitids: string[] = [];

    for (const t of transactions) {
        const existingRecord = existingByFitid.get(t.syntheticId);
        if (!existingRecord) {
            toInsert.push(t);
        } else if (existingRecord.isPending && !t.pending) {
            toClearFitids.push(t.syntheticId);
        }
        // else: already exists and up to date — skip
    }

    skippedCount  = transactions.length - toInsert.length - toClearFitids.length;
    importedCount = toInsert.length + toClearFitids.length;

    if (!input.dryRun) {
        if (toInsert.length > 0) {
            await prisma.transaction.createMany({
                data: toInsert.map(t => ({
                    userId: input.userId,
                    accountId: input.accountId,
                    fitid: t.syntheticId,
                    date: new Date(t.date),
                    originalDate: new Date(t.date),
                    description: t.description,
                    amount: Math.abs(t.amount),
                    transactionType: t.amount >= 0 ? 'income' : 'expense',
                    isActive: true,
                    isPending: t.pending
                }))
            });
        }

        if (toClearFitids.length > 0) {
            await prisma.transaction.updateMany({
                where: {userId: input.userId, fitid: {in: toClearFitids}},
                data: {isPending: false}
            });
        }

        // Hard-delete any scraper-originated transactions in the scrape window
        // that were not returned by this scrape (e.g. stale pending where date or
        // description changed on settlement). Only touches fitid-tagged rows to
        // preserve manually-entered and OFX-imported transactions.
        await prisma.transaction.deleteMany({
            where: {
                userId: input.userId,
                accountId: input.accountId,
                fitid: {not: null, notIn: syntheticIds},
                date: {
                    gte: new Date(input.startDate),
                    lte: new Date(input.endDate)
                }
            }
        });
    }

    parentPort.postMessage({
        type: 'result',
        transactions,
        importedCount,
        skippedCount
    });

} finally {
    await scraper?.cleanup?.();
    await prisma.$disconnect();
}
