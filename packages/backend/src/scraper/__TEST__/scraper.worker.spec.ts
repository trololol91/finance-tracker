/**
 * scraper.worker.spec.ts
 *
 * Tests for the Phase 7 stub worker entry point (scraper.worker.ts).
 *
 * The worker uses top-level execution code — it runs imperatively on import
 * rather than exporting a class or function. Testing it requires:
 *   1. Mocking `worker_threads` to inject controlled `workerData` and a spy
 *      `parentPort` before the module executes.
 *   2. Using `vi.resetModules()` + dynamic `await import(...)` to re-execute
 *      the module for each test (a cached module import is a no-op).
 *
 * NOTE: `scraper.worker.ts` carries `/* v8 ignore file *\/` so v8 coverage
 * is suppressed for this file. The vitest.config.ts also excludes it from
 * coverage reporting. These tests verify observable behaviour only.
 */
import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import type {ScraperWorkerInput} from '#scraper/interfaces/bank-scraper.interface.js';
import {SyncJobStatus} from '#scraper/sync-job-status.js';

// ---------------------------------------------------------------------------
// Shared mock state — must be hoisted so vi.mock factory can close over it.
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
    postMessage: vi.fn(),
    workerData: {
        bankId: 'cibc',
        inputs: {username: 'u', password: 'p'},
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-03-15T00:00:00.000Z',
        accountId: 'acct-1',
        jobId: 'job-1',
        userId: 'user-1',
        dryRun: false
    } as ScraperWorkerInput
}));

// Mock worker_threads so that when the worker module is imported it receives
// our controlled workerData and a spy parentPort instead of the real ones.
vi.mock('worker_threads', () => ({
    get workerData() {
        return mockState.workerData;
    },
    get parentPort() {
        return {postMessage: mockState.postMessage};
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-execute the worker module with the current mockState configuration. */
const importWorker = async (): Promise<void> => {
    vi.resetModules();
    await import('#scraper/scraper.worker.js');
};

// ---------------------------------------------------------------------------
// Test suite — Phase 7 stub behaviour
// ---------------------------------------------------------------------------

describe('scraper.worker.ts (Phase 7 stub)', () => {
    beforeEach(() => {
        mockState.postMessage.mockReset();
        // Reset to default non-dryRun input before each test
        mockState.workerData = {
            bankId: 'cibc',
            inputs: {username: 'u', password: 'p'},
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2026-03-15T00:00:00.000Z',
            accountId: 'acct-1',
            jobId: 'job-1',
            userId: 'user-1',
            dryRun: false
        };
    });

    it('should post a result message with an empty transactions array', async () => {
        await importWorker();

        const calls = mockState.postMessage.mock.calls;
        const resultCall = calls.find(
            ([msg]) =>
                typeof msg === 'object' &&
                msg !== null &&
                (msg as {type: string}).type === 'result'
        );

        expect(resultCall).toBeDefined();
        const resultMsg = resultCall![0] as {type: string, transactions: unknown[]};
        expect(resultMsg.type).toBe('result');
        expect(resultMsg.transactions).toEqual([]);
    });

    it('should post a status message with loggingIn status before the result', async () => {
        await importWorker();

        const calls = mockState.postMessage.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(2);

        const firstMsg = calls[0][0] as {type: string, status: string, message: string};
        expect(firstMsg.type).toBe('status');
        expect(firstMsg.status).toBe(SyncJobStatus.loggingIn);
        expect(firstMsg.message).toContain('cibc');

        // The status message must appear before the result message
        const statusIndex = calls.findIndex(
            ([msg]) => (msg as {type: string}).type === 'status'
        );
        const resultIndex = calls.findIndex(
            ([msg]) => (msg as {type: string}).type === 'result'
        );
        expect(statusIndex).toBeLessThan(resultIndex);
    });

    it('should include the bankId in the loggingIn status message', async () => {
        mockState.workerData = {...mockState.workerData, bankId: 'rbc'};

        await importWorker();

        const statusCall = mockState.postMessage.mock.calls.find(
            ([msg]) => (msg as {type: string}).type === 'status'
        );
        expect(statusCall).toBeDefined();
        const statusMsg = statusCall![0] as {message: string};
        expect(statusMsg.message).toContain('rbc');
    });

    it('should post the result message regardless of dryRun: false', async () => {
        mockState.workerData = {...mockState.workerData, dryRun: false};

        await importWorker();

        const resultCall = mockState.postMessage.mock.calls.find(
            ([msg]) => (msg as {type: string}).type === 'result'
        );
        expect(resultCall).toBeDefined();
        const resultMsg = resultCall![0] as {transactions: unknown[]};
        expect(resultMsg.transactions).toEqual([]);
    });

    it('should post the result message regardless of dryRun: true', async () => {
        mockState.workerData = {...mockState.workerData, dryRun: true};

        await importWorker();

        const resultCall = mockState.postMessage.mock.calls.find(
            ([msg]) => (msg as {type: string}).type === 'result'
        );
        expect(resultCall).toBeDefined();
        const resultMsg = resultCall![0] as {transactions: unknown[]};
        expect(resultMsg.transactions).toEqual([]);
    });

    // -------------------------------------------------------------------------
    // Phase 8 stubs — not implemented yet; createMany does not exist in Phase 7
    // -------------------------------------------------------------------------

    it.todo('dryRun: false — prisma.transaction.createMany is called with deduped rows');
    it.todo('dryRun: true — prisma.transaction.createMany is NOT called; importedCount is 0');
    it.todo('dryRun: true — skippedCount reflects dedup against existing fitids');
});
