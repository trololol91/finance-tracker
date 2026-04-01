/**
 * scraper.worker.spec.ts
 *
 * Tests for the Phase 8 worker entry point (scraper.worker.ts).
 *
 * The worker uses top-level execution code — it runs imperatively on import
 * rather than exporting a class or function. Testing it requires:
 *   1. Mocking `worker_threads`, `#generated/prisma/client.js`,
 *      and `@prisma/adapter-pg` before the module executes.
 *   2. Using `vi.resetModules()` + dynamic `await import(...)` to re-execute
 *      the module for each test (a cached module import is a no-op).
 *
 * Plugin loading strategy: set pluginPath to the real resolved URL of
 * stub.scraper.js via import.meta.resolve so the worker's dynamic import()
 * loads the real stub scraper without touching a fake file:// URL.
 *
 * For tests that need a custom scraper (MFA, error), vi.doMock the resolved
 * stub URL before importWorker() and vi.doUnmock after.
 */
import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import type {
    ScraperWorkerInput, BankScraper, PluginInputs
} from '#scraper/interfaces/bank-scraper.interface.js';
import {SyncJobStatus} from '#scraper/sync-job-status.js';
import stubScraper from '@finance-tracker/scraper-stub';

// Resolve the real file:// URL of the compiled stub scraper so the worker's
// dynamic import() can load it without requiring a fake URL mock.
const STUB_PLUGIN_URL = import.meta.resolve('@finance-tracker/scraper-stub');

// ---------------------------------------------------------------------------
// Shared mock state — must be hoisted so vi.mock factory can close over it.
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
    postMessage: vi.fn(),
    once: vi.fn(),
    workerData: {
        bankId: 'stub',
        inputs: {username: 'test-user'},
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-03-15T00:00:00.000Z',
        accountId: 'acct-1',
        jobId: 'job-1',
        userId: 'user-1',
        dryRun: false,
        pluginPath: '',       // filled in beforeEach after STUB_PLUGIN_URL resolves
        databaseUrl: 'postgresql://test:test@localhost:5432/test'
    } as ScraperWorkerInput
}));

// ---------------------------------------------------------------------------
// Prisma mocks — generated client + adapter
// Hoisted so vi.mock factories can close over them.
// ---------------------------------------------------------------------------

const prismaMocks = vi.hoisted(() => ({
    findMany: vi.fn().mockResolvedValue([]),
    createMany: vi.fn().mockResolvedValue({count: 0}),
    updateMany: vi.fn().mockResolvedValue({count: 0}),
    deleteMany: vi.fn().mockResolvedValue({count: 0}),
    disconnect: vi.fn().mockResolvedValue(undefined)
}));

const mockPrismaFindMany = prismaMocks.findMany;
const mockPrismaCreateMany = prismaMocks.createMany;
const mockPrismaUpdateMany = prismaMocks.updateMany;
const mockPrismaDeleteMany = prismaMocks.deleteMany;
const mockPrismaDisconnect = prismaMocks.disconnect;

vi.mock('#generated/prisma/client.js', () => ({
    PrismaClient: class MockPrismaClient {
        public transaction = {
            findMany: prismaMocks.findMany,
            createMany: prismaMocks.createMany,
            updateMany: prismaMocks.updateMany,
            deleteMany: prismaMocks.deleteMany
        };
        public $disconnect = prismaMocks.disconnect;
        constructor(_opts: unknown) {}
    }
}));

vi.mock('@prisma/adapter-pg', () => ({
     
    PrismaPg: class MockPrismaPg {
        constructor(_opts: unknown) {}
    }
}));

// ---------------------------------------------------------------------------
// worker_threads mock
// ---------------------------------------------------------------------------

vi.mock('worker_threads', () => ({
    get workerData() {
        return mockState.workerData;
    },
    get parentPort() {
        return {
            postMessage: mockState.postMessage,
            once: mockState.once
        };
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Re-execute the worker module with the current mockState configuration.
 * An optional `setup` callback runs AFTER vi.resetModules() but BEFORE the
 * dynamic import — use it to call vi.doMock() for per-test overrides.
 */
const importWorker = async (setup?: () => void): Promise<void> => {
    vi.resetModules();
    setup?.();
    await import('#scraper/scraper.worker.js');
};

const getResultMsg = (): {
    type: string;
    transactions: {syntheticId: string, amount: number}[];
    importedCount: number;
    skippedCount: number;
} | undefined => {
    const call = mockState.postMessage.mock.calls.find(
        ([msg]) => (msg as {type: string}).type === 'result'
    );
    return call?.[0] as ReturnType<typeof getResultMsg>;
};

// ---------------------------------------------------------------------------
// Test suite — Phase 8 behaviour
// ---------------------------------------------------------------------------

describe('scraper.worker.ts (Phase 8)', () => {
    beforeEach(() => {
        mockState.postMessage.mockReset();
        mockState.once.mockReset();
        mockPrismaFindMany.mockReset().mockResolvedValue([]);
        mockPrismaCreateMany.mockReset().mockResolvedValue({count: 0});
        mockPrismaUpdateMany.mockReset().mockResolvedValue({count: 0});
        mockPrismaDeleteMany.mockReset().mockResolvedValue({count: 0});
        mockPrismaDisconnect.mockReset().mockResolvedValue(undefined);

        // Reset to default stub input with the real plugin URL
        mockState.workerData = {
            bankId: 'stub',
            inputs: {username: 'test-user'},
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2026-03-15T00:00:00.000Z',
            accountId: 'acct-1',
            jobId: 'job-1',
            userId: 'user-1',
            dryRun: false,
            pluginPath: STUB_PLUGIN_URL,
            databaseUrl: 'postgresql://test:test@localhost:5432/test'
        };
    });

    // TC-W-01
    it('posts loggingIn status message before result', async () => {
        await importWorker();

        const calls = mockState.postMessage.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(2);

        const firstMsg = calls[0][0] as {type: string, status: string};
        expect(firstMsg.type).toBe('status');
        expect(firstMsg.status).toBe(SyncJobStatus.loggingIn);

        const statusIndex = calls.findIndex(([m]) => (m as {type: string}).type === 'status');
        const resultIndex = calls.findIndex(([m]) => (m as {type: string}).type === 'result');
        expect(statusIndex).toBeLessThan(resultIndex);
    });

    // TC-W-11 (migrated from Phase 7)
    it('includes the bankId in the loggingIn status message', async () => {
        await importWorker();

        const statusCall = mockState.postMessage.mock.calls.find(
            ([m]) => (m as {type: string}).type === 'status'
        );
        expect(statusCall).toBeDefined();
        const statusMsg = statusCall![0] as {message: string};
        expect(statusMsg.message).toContain('stub');
    });

    // TC-W-02
    it('posts result message with 3 transactions from stub scraper', async () => {
        await importWorker();

        const resultMsg = getResultMsg();
        expect(resultMsg).toBeDefined();
        expect(resultMsg!.type).toBe('result');
        expect(resultMsg!.transactions).toHaveLength(3);
        expect(resultMsg!.transactions[0].syntheticId).toBe('stub-aaa-0001');
    });

    // TC-W-03
    it('dryRun: false — prisma.transaction.createMany is called with deduped rows', async () => {
        mockState.workerData = {...mockState.workerData, dryRun: false};
        mockPrismaFindMany.mockResolvedValue([]);

        await importWorker();

        expect(mockPrismaCreateMany).toHaveBeenCalledOnce();
        const callArgs = mockPrismaCreateMany.mock.calls[0][0] as {data: unknown[]};
        expect(callArgs.data).toHaveLength(3);
    });

    // TC-W-04
    it('dryRun: true — prisma.transaction.createMany and deleteMany are NOT called', async () => {
        mockState.workerData = {...mockState.workerData, dryRun: true};

        await importWorker();

        expect(mockPrismaCreateMany).not.toHaveBeenCalled();
        expect(mockPrismaDeleteMany).not.toHaveBeenCalled();

        const resultMsg = getResultMsg();
        expect(resultMsg!.importedCount).toBe(3);
    });

    // TC-W-12 (migrated from Phase 7)
    it('posts result regardless of dryRun: true', async () => {
        mockState.workerData = {...mockState.workerData, dryRun: true};

        await importWorker();

        const resultMsg = getResultMsg();
        expect(resultMsg).toBeDefined();
        expect(resultMsg!.type).toBe('result');
    });

    // TC-W-05
    it('dedup: existing fitids are skipped; skippedCount reflects real dedup', async () => {
        mockPrismaFindMany.mockResolvedValue([{fitid: 'stub-aaa-0001', isPending: false}]);

        await importWorker();

        const callArgs = mockPrismaCreateMany.mock.calls[0][0] as {data: unknown[]};
        expect(callArgs.data).toHaveLength(2);

        const resultMsg = getResultMsg();
        expect(resultMsg!.skippedCount).toBe(1);
        expect(resultMsg!.importedCount).toBe(2);
    });

    // TC-W-06
    it('dedup: all 3 rows already exist — createMany not called; importedCount 0', async () => {
        mockPrismaFindMany.mockResolvedValue([
            {fitid: 'stub-aaa-0001', isPending: false},
            {fitid: 'stub-bbb-0002', isPending: false},
            {fitid: 'stub-ccc-0003', isPending: false}
        ]);

        await importWorker();

        expect(mockPrismaCreateMany).not.toHaveBeenCalled();

        const resultMsg = getResultMsg();
        expect(resultMsg!.importedCount).toBe(0);
        expect(resultMsg!.skippedCount).toBe(3);
    });

    // TC-W-15
    it('pending→cleared (same syntheticId): updateMany sets isPending=false; createMany not called for it', async () => {
        // DB has stub-ccc-0003 stored as pending; scraper now returns it as cleared
        mockPrismaFindMany.mockResolvedValue([{fitid: 'stub-ccc-0003', isPending: true}]);

        const clearedScraper: BankScraper = {
            ...stubScraper,
            scrapeTransactions: vi.fn().mockResolvedValue([
                {date: '2026-01-20', description: 'Stub Transaction C', amount: -7.50, pending: false, syntheticId: 'stub-ccc-0003'}
            ])
        };

        await importWorker(() => {
            vi.doMock(STUB_PLUGIN_URL, () => ({default: clearedScraper}));
        });
        vi.doUnmock(STUB_PLUGIN_URL);

        expect(mockPrismaUpdateMany).toHaveBeenCalledOnce();
        expect(mockPrismaUpdateMany).toHaveBeenCalledWith(
            expect.objectContaining({data: {isPending: false}})
        );
        expect(mockPrismaCreateMany).not.toHaveBeenCalled();

        const resultMsg = getResultMsg();
        expect(resultMsg!.importedCount).toBe(1);
        expect(resultMsg!.skippedCount).toBe(0);
    });

    // TC-W-16
    it('stale pending (syntheticId changed on settlement): deleteMany removes old record within scrape window', async () => {
        // Scraper returns only the cleared version with a new syntheticId
        // (date/description changed on settlement). Old pending is no longer in results.
        const clearedScraper: BankScraper = {
            ...stubScraper,
            scrapeTransactions: vi.fn().mockResolvedValue([
                {date: '2026-01-22', description: 'TIM HORTONS #1234', amount: -5.00, pending: false, syntheticId: 'new-cleared-id'}
            ])
        };

        await importWorker(() => {
            vi.doMock(STUB_PLUGIN_URL, () => ({default: clearedScraper}));
        });
        vi.doUnmock(STUB_PLUGIN_URL);

        expect(mockPrismaDeleteMany).toHaveBeenCalledOnce();
        expect(mockPrismaDeleteMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: 'user-1',
                    accountId: 'acct-1',
                    fitid: expect.objectContaining({notIn: ['new-cleared-id']})
                })
            })
        );
        // The new cleared transaction is inserted
        expect(mockPrismaCreateMany).toHaveBeenCalledOnce();
    });

    // TC-W-17
    it('dryRun: true — deleteMany is NOT called even with stale pending records', async () => {
        mockState.workerData = {...mockState.workerData, dryRun: true};

        const clearedScraper: BankScraper = {
            ...stubScraper,
            scrapeTransactions: vi.fn().mockResolvedValue([
                {date: '2026-01-22', description: 'TIM HORTONS #1234', amount: -5.00, pending: false, syntheticId: 'new-cleared-id'}
            ])
        };

        await importWorker(() => {
            vi.doMock(STUB_PLUGIN_URL, () => ({default: clearedScraper}));
        });
        vi.doUnmock(STUB_PLUGIN_URL);

        expect(mockPrismaDeleteMany).not.toHaveBeenCalled();
    });

    // TC-W-07
    it('MFA bridge: posts mfa_required and passes code via resolver', async () => {
        const mfaScraper: BankScraper = {
            ...stubScraper,
            login: vi.fn().mockImplementation(
                async (_inputs: PluginInputs, resolveMfa?: (p: string) => Promise<string>) => {
                    await resolveMfa?.('Enter your OTP');
                }
            )
        };

        mockState.once.mockImplementation(
            (_event: string, cb: (msg: {code: string}) => void) => { cb({code: '123456'}); }
        );

        await importWorker(() => {
            vi.doMock(STUB_PLUGIN_URL, () => ({default: mfaScraper}));
        });

        vi.doUnmock(STUB_PLUGIN_URL);

        expect(mockState.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({type: 'mfa_required', prompt: 'Enter your OTP'})
        );
        // Scrape still proceeds after MFA
        expect(getResultMsg()).toBeDefined();
    });

    // TC-W-09
    it('prisma.$disconnect is called in finally on success', async () => {
        await importWorker();

        expect(mockPrismaDisconnect).toHaveBeenCalledOnce();
    });

    // TC-W-10
    it('prisma.$disconnect is called in finally on error', async () => {
        const errorScraper: BankScraper = {
            ...stubScraper,
            scrapeTransactions: vi.fn().mockRejectedValue(new Error('Network error'))
        };

        await expect(
            importWorker(() => {
                vi.doMock(STUB_PLUGIN_URL, () => ({default: errorScraper}));
            })
        ).rejects.toThrow('Network error');

        vi.doUnmock(STUB_PLUGIN_URL);

        expect(mockPrismaDisconnect).toHaveBeenCalledOnce();
        expect(mockState.postMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({type: 'result'})
        );
    });

    // TC-W-13
    it('cleanup() is called in finally on success when plugin defines it', async () => {
        const cleanupSpy = vi.fn().mockResolvedValue(undefined);
        const scraperWithCleanup: BankScraper = {
            ...stubScraper,
            cleanup: cleanupSpy
        };

        await importWorker(() => {
            vi.doMock(STUB_PLUGIN_URL, () => ({default: scraperWithCleanup}));
        });

        vi.doUnmock(STUB_PLUGIN_URL);

        expect(cleanupSpy).toHaveBeenCalledOnce();
    });

    // TC-W-14
    it('cleanup() is called in finally on error when plugin defines it', async () => {
        const cleanupSpy = vi.fn().mockResolvedValue(undefined);
        const errorScraper: BankScraper = {
            ...stubScraper,
            scrapeTransactions: vi.fn().mockRejectedValue(new Error('Scrape failed')),
            cleanup: cleanupSpy
        };

        await expect(
            importWorker(() => {
                vi.doMock(STUB_PLUGIN_URL, () => ({default: errorScraper}));
            })
        ).rejects.toThrow('Scrape failed');

        vi.doUnmock(STUB_PLUGIN_URL);

        expect(cleanupSpy).toHaveBeenCalledOnce();
    });
});
