import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {NotFoundException} from '@nestjs/common';
import {ScraperService} from '#scraper/scraper.service.js';
import {SyncSessionStore} from '#scraper/sync-session.store.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {CryptoService} from '#scraper/crypto/crypto.service.js';
import type {PushService} from '#push/push.service.js';
import type {SyncSchedule} from '#generated/prisma/client.js';
import type {
    RawTransaction, ScraperWorkerInput
} from '#scraper/interfaces/bank-scraper.interface.js';
import type {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {CategoriesService} from '#categories/categories.service.js';
import type {AiCategorizationService} from '#ai-categorization/ai-categorization.service.js';
import type {CategoryRulesService} from '#category-rules/category-rules.service.js';
import type {ConfigService} from '@nestjs/config';

// ---------------------------------------------------------------------------
// Worker mock — prevents real worker_threads spawning in unit tests
// ---------------------------------------------------------------------------

const workerHandlers = vi.hoisted(() => ({
    message: undefined as ((msg: unknown) => void) | undefined,
    error: undefined as ((err: Error) => void) | undefined,
    terminate: vi.fn(),
    lastWorkerData: undefined as unknown
}));

vi.mock('worker_threads', () => ({
    Worker: class MockWorker {
        constructor(_path: string, options: {workerData: unknown}) {
            workerHandlers.lastWorkerData = options.workerData;
        }
        public on(event: string, handler: (arg: unknown) => void): void {
            if (event === 'message') {
                workerHandlers.message = handler;
            } else if (event === 'error') {
                workerHandlers.error = handler as (err: Error) => void;
            } else if (event === 'exit') {
                (handler as (code: number) => void)(0);
            }
        }
        public postMessage(_msg: unknown): void { /* no-op */ }
        public terminate(): void { workerHandlers.terminate(); }
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockSchedule = {
    id: 'sched-1',
    userId: 'user-1',
    accountId: 'acct-1',
    bankId: 'cibc',
    pluginConfigEnc: 'encrypted-data',
    cron: '0 8 * * *',
    enabled: true,
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessfulSyncAt: null,
    lookbackDays: 3,
    autoCategorizeLlm: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
} as unknown as SyncSchedule;

const mockJob = {
    id: 'job-uuid-1',
    userId: 'user-1',
    syncScheduleId: 'sched-1',
    triggeredBy: 'manual',
    status: 'pending',
    message: null,
    mfaChallenge: null,
    importedCount: 0,
    skippedCount: 0,
    errorMessage: null,
    requestStartDate: null,
    requestEndDate: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ScraperService', () => {
    let service: ScraperService;
    let prisma: PrismaService;
    let cryptoService: CryptoService;
    let sessionStore: SyncSessionStore;
    let pushService: PushService;
    let mockRegistry: {getPluginPath: ReturnType<typeof vi.fn>};

    beforeEach(() => {
        workerHandlers.message = undefined;
        workerHandlers.error = undefined;
        workerHandlers.terminate.mockReset();
        workerHandlers.lastWorkerData = undefined;

        prisma = {
            syncSchedule: {
                findFirst: vi.fn(),
                update: vi.fn()
            },
            syncJob: {
                create: vi.fn(),
                update: vi.fn(),
                findUnique: vi.fn()
            },
            transaction: {
                findMany: vi.fn().mockResolvedValue([]),
                update: vi.fn().mockResolvedValue({})
            },
            $transaction: vi.fn().mockResolvedValue([])
        } as unknown as PrismaService;

        cryptoService = {
            decrypt: vi.fn().mockReturnValue(
                JSON.stringify({username: 'user1', password: 'pass1'})
            ),
            encrypt: vi.fn()
        } as unknown as CryptoService;

        sessionStore = new SyncSessionStore();
        pushService = {
            sendNotification: vi.fn().mockResolvedValue(undefined)
        } as unknown as PushService;
        const configService = {
            get: vi.fn().mockImplementation((key: string) =>
                key === 'CORS_ORIGIN' ? 'http://localhost:3002' : undefined
            )
        } as unknown as ConfigService;
        mockRegistry = {
            getPluginPath: vi.fn().mockReturnValue('file:///plugins/cibc.scraper.js')
        };
        const categoriesService =
            {findAll: vi.fn().mockResolvedValue([])} as unknown as CategoriesService;
        const aiCategorizationService =
            {
                suggestCategory: vi.fn().mockResolvedValue('Other'),
                suggestCategories: vi.fn().mockResolvedValue(new Map())
            } as unknown as AiCategorizationService;

        const categoryRulesService = {
            buildMatcher: vi.fn().mockResolvedValue(() => null)
        } as unknown as CategoryRulesService;

        service = new ScraperService(
            prisma,
            cryptoService,
            sessionStore,
            pushService,
            mockRegistry as unknown as ScraperRegistry,
            categoriesService,
            aiCategorizationService,
            categoryRulesService,
            configService
        );

        vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(mockSchedule);
        vi.mocked(prisma.syncJob.create).mockResolvedValue(mockJob);
        vi.mocked(prisma.syncJob.update).mockResolvedValue(mockJob);
        vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(mockJob);
        vi.mocked(prisma.syncSchedule.update).mockResolvedValue(mockSchedule);
    });

    // -------------------------------------------------------------------------
    // sync
    // -------------------------------------------------------------------------

    describe('sync', () => {
        it('should create a SyncJob and return a sessionId immediately', async () => {
            const result = await service.sync('user-1', 'sched-1', 'manual');

            expect(result.sessionId).toBe(mockJob.id);
            expect(prisma.syncJob.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 'user-1',
                        syncScheduleId: 'sched-1',
                        triggeredBy: 'manual',
                        status: 'pending'
                    })
                })
            );
        });

        it('should default triggeredBy to manual', async () => {
            await service.sync('user-1', 'sched-1');

            expect(prisma.syncJob.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({triggeredBy: 'manual'})
                })
            );
        });

        it('should create a session in SyncSessionStore', async () => {
            const result = await service.sync('user-1', 'sched-1');

            expect(sessionStore.hasSession(result.sessionId)).toBe(true);
        });

        it('should throw NotFoundException when schedule not found', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(null);

            await expect(service.sync('user-1', 'missing-id')).rejects.toThrow(
                NotFoundException
            );
        });

        it('should pass dryRun: true to the worker input when dryRun is true', async () => {
            await service.sync('user-1', 'sched-1', 'manual', undefined, true);
            await new Promise<void>(resolve => { setImmediate(resolve); });

            const workerInput = workerHandlers.lastWorkerData as ScraperWorkerInput;
            expect(workerInput.dryRun).toBe(true);
            expect(workerInput.pluginPath).toBe('file:///plugins/cibc.scraper.js');
            expect(workerInput.databaseUrl).toEqual(expect.any(String));
        });

        it('should pass dryRun: false to the worker input when dryRun is not provided', async () => {
            await service.sync('user-1', 'sched-1', 'manual', undefined);
            await new Promise<void>(resolve => { setImmediate(resolve); });

            const workerInput = workerHandlers.lastWorkerData as ScraperWorkerInput;
            expect(workerInput.dryRun).toBe(false);
            expect(workerInput.pluginPath).toBe('file:///plugins/cibc.scraper.js');
            expect(workerInput.databaseUrl).toEqual(expect.any(String));
        });

        it('should pass dryRun: false to the worker input when dryRun is explicitly false', async () => {
            await service.sync('user-1', 'sched-1', 'manual', undefined, false);
            await new Promise<void>(resolve => { setImmediate(resolve); });

            const workerInput = workerHandlers.lastWorkerData as ScraperWorkerInput;
            expect(workerInput.dryRun).toBe(false);
            expect(workerInput.pluginPath).toBe('file:///plugins/cibc.scraper.js');
            expect(workerInput.databaseUrl).toEqual(expect.any(String));
        });

        // TC-SV-01
        it('sync() should mark job failed when no plugin is registered for bankId', async () => {
            mockRegistry.getPluginPath.mockReturnValue(undefined);

            await service.sync('user-1', 'sched-1', 'manual');
            await new Promise<void>(resolve => { setImmediate(resolve); });

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({status: 'failed'})
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // runWorker integration — exercises worker.on('message') callback branches
    // -------------------------------------------------------------------------

    describe('runWorker integration (via Worker mock)', () => {
        it('should ignore non-WorkerMessage payloads (isWorkerMessage guard)', async () => {
            await service.sync('user-1', 'sched-1');
            // Flush microtasks so runWorker() registers worker.on() handlers
            await new Promise<void>(resolve => { setImmediate(resolve); });

            // Send an invalid (non-WorkerMessage) payload — guard returns early
            workerHandlers.message?.('this is not a WorkerMessage');
            // No exceptions expected; no state changes
        });

        it('should handle result WorkerMessage via worker.on message callback', async () => {
            const {sessionId} = await service.sync('user-1', 'sched-1');
            await new Promise<void>(resolve => { setImmediate(resolve); });

            workerHandlers.message?.({type: 'result', transactions: [], importedCount: 0, skippedCount: 0});
            await new Promise<void>(resolve => { setImmediate(resolve); });

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({data: expect.objectContaining({status: 'complete'})})
            );
            expect(sessionStore.hasSession(sessionId)).toBe(false);
        });

        it('should handle errors via worker.on error callback', async () => {
            const {sessionId} = await service.sync('user-1', 'sched-1');
            await new Promise<void>(resolve => { setImmediate(resolve); });

            workerHandlers.error?.(new Error('Worker crash'));
            await new Promise<void>(resolve => { setImmediate(resolve); });

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({data: expect.objectContaining({status: 'failed'})})
            );
            expect(sessionStore.hasSession(sessionId)).toBe(false);
        });

    });

    // -------------------------------------------------------------------------
    // computeStartDate (private — accessed via type cast)
    // -------------------------------------------------------------------------

    describe('computeStartDate', () => {
        interface InternalService {
            computeStartDate: (schedule: SyncSchedule) => Date;
        }

        it('should return 30-day lookback when lastSuccessfulSyncAt is null', () => {
            const svc = service as unknown as InternalService;
            const before = Date.now() - 30 * 24 * 60 * 60 * 1000;

            const result = svc.computeStartDate(mockSchedule);

            expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            expect(result.getTime()).toBeLessThanOrEqual(thirtyDaysAgo + 100);
        });

        it('should subtract lookbackDays from lastSuccessfulSyncAt', () => {
            const svc = service as unknown as InternalService;
            const lastSync = new Date('2026-01-15T00:00:00.000Z');
            const withLastSync = {
                ...mockSchedule,
                lastSuccessfulSyncAt: lastSync,
                lookbackDays: 3
            } as unknown as SyncSchedule;

            const result = svc.computeStartDate(withLastSync);

            expect(result.toISOString()).toBe('2026-01-12T00:00:00.000Z');
        });
    });

    // -------------------------------------------------------------------------
    // handleResult (private — accessed via type cast)
    // -------------------------------------------------------------------------

    describe('handleResult', () => {
        interface InternalService {
            handleResult: (
                sessionId: string,
                jobId: string,
                schedule: SyncSchedule,
                result: {
                    transactions: RawTransaction[];
                    importedCount: number;
                    skippedCount: number;
                }
            ) => Promise<void>;
        }

        it('should update job to complete and emit complete event', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-1');
            const received: string[] = [];
            sessionStore.getObservable('job-1').subscribe(e => received.push(e.data as string));

            await svc.handleResult('job-1', 'job-1', mockSchedule, {
                transactions: [],
                importedCount: 0,
                skippedCount: 0
            });

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {id: 'job-1'},
                    data: expect.objectContaining({status: 'complete'})
                })
            );
            expect(received.some(d => d.includes('"complete"'))).toBe(true);
        });

        it('should update schedule lastRunStatus to success', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-2');

            await svc.handleResult('job-2', 'job-2', mockSchedule, {
                transactions: [],
                importedCount: 0,
                skippedCount: 0
            });

            expect(prisma.syncSchedule.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({lastRunStatus: 'success'})
                })
            );
        });

        it('should complete the session after handling result', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-3');

            await svc.handleResult('job-3', 'job-3', mockSchedule, {
                transactions: [],
                importedCount: 0,
                skippedCount: 0
            });

            expect(sessionStore.hasSession('job-3')).toBe(false);
        });

        it('should report importedCount from the result object', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-4');
            const received: string[] = [];
            sessionStore.getObservable('job-4').subscribe(e => received.push(e.data as string));

            await svc.handleResult('job-4', 'job-4', mockSchedule, {
                transactions: [{} as RawTransaction, {} as RawTransaction],
                importedCount: 2,
                skippedCount: 0
            });

            const completeEvent = received.find(d => d.includes('"complete"'));
            expect(completeEvent).toContain('"importedCount":2');
        });

        // TC-SV-03: autoCategorizeLlm=true triggers AI categorization
        it('should call suggestCategories and batch-update when autoCategorizeLlm=true', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-llm-true');

            const scheduleWithLlm =
                {...mockSchedule, autoCategorizeLlm: true} as unknown as SyncSchedule;

            const mockTx = {
                id: 'tx-1',
                description: 'GROCERY STORE',
                amount: 50,
                transactionType: 'expense'
            };
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTx] as never);
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockJob,
                startedAt: new Date('2026-01-01T08:00:00.000Z')
            } as never);

            const mockCategory = {id: 'cat-1', name: 'Food & Dining', isActive: true};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const categoriesService = (service as any).categoriesService as
                {findAll: ReturnType<typeof vi.fn>};
            categoriesService.findAll.mockResolvedValue([mockCategory]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const aiService = (service as any).aiCategorizationService as
                {suggestCategories: ReturnType<typeof vi.fn>};
            aiService.suggestCategories.mockResolvedValue(
                new Map([['tx-1', 'Food & Dining']])
            );

            await svc.handleResult('job-llm-true', 'job-llm-true', scheduleWithLlm, {
                transactions: [{} as RawTransaction],
                importedCount: 1,
                skippedCount: 0
            });

            expect(aiService.suggestCategories).toHaveBeenCalledWith(
                [{
                    id: 'tx-1',
                    description: 'GROCERY STORE',
                    transactionType: 'expense'
                }],
                ['Food & Dining']
            );
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        // Issue 2: autoCategorizeSyncedTransactions skips when no active categories
        it('should NOT call suggestCategories when categoriesService returns no active categories', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-no-cats');

            const scheduleWithLlm =
                {...mockSchedule, autoCategorizeLlm: true} as unknown as SyncSchedule;

            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockJob,
                startedAt: new Date('2026-01-01T08:00:00.000Z')
            } as never);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const categoriesService = (service as any).categoriesService as
                {findAll: ReturnType<typeof vi.fn>};
            // Return only inactive categories — active.length will be 0
            categoriesService.findAll.mockResolvedValue([
                {id: 'cat-x', name: 'Archived', isActive: false}
            ]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const aiService = (service as any).aiCategorizationService as
                {suggestCategories: ReturnType<typeof vi.fn>};
            aiService.suggestCategories.mockClear();

            await svc.handleResult('job-no-cats', 'job-no-cats', scheduleWithLlm, {
                transactions: [{} as RawTransaction],
                importedCount: 1,
                skippedCount: 0
            });

            expect(aiService.suggestCategories).not.toHaveBeenCalled();
        });

        // TC-SV-04: autoCategorizeLlm=false does NOT call suggestCategories
        it('should NOT call suggestCategories when autoCategorizeLlm=false', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-llm-false');

            const scheduleNoLlm =
                {...mockSchedule, autoCategorizeLlm: false} as unknown as SyncSchedule;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const aiService = (service as any).aiCategorizationService as
                {suggestCategories: ReturnType<typeof vi.fn>};
            aiService.suggestCategories.mockClear();

            await svc.handleResult('job-llm-false', 'job-llm-false', scheduleNoLlm, {
                transactions: [{} as RawTransaction],
                importedCount: 1,
                skippedCount: 0
            });

            expect(aiService.suggestCategories).not.toHaveBeenCalled();
        });

        // TC-SV-02
        it('handleResult reads skippedCount from the message object', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('job-skip');
            const received: string[] = [];
            sessionStore.getObservable('job-skip').subscribe(e => received.push(e.data as string));

            await svc.handleResult('job-skip', 'job-skip', mockSchedule, {
                transactions: [],
                importedCount: 1,
                skippedCount: 3
            });

            const completeEvent = received.find(d => d.includes('"complete"'));
            expect(completeEvent).toContain('"skippedCount":3');
            expect(completeEvent).toContain('"importedCount":1');
        });
    });

    // -------------------------------------------------------------------------
    // handleWorkerError (private — accessed via type cast)
    // -------------------------------------------------------------------------

    describe('handleWorkerError', () => {
        interface InternalService {
            handleWorkerError: (
                sessionId: string,
                jobId: string,
                schedule: SyncSchedule,
                err: Error
            ) => Promise<void>;
        }

        it('should update job to failed and emit failed event', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('fail-job');
            const received: string[] = [];
            sessionStore.getObservable('fail-job').subscribe(e => received.push(e.data as string));

            await svc.handleWorkerError(
                'fail-job', 'fail-job', mockSchedule, new Error('Login failed')
            );

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'failed',
                        errorMessage: 'Login failed'
                    })
                })
            );
            expect(received.some(d => d.includes('"failed"'))).toBe(true);
        });

        it('should update schedule lastRunStatus to failed', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('fail-job-2');

            await svc.handleWorkerError(
                'fail-job-2', 'fail-job-2', mockSchedule, new Error('Timeout')
            );

            expect(prisma.syncSchedule.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({lastRunStatus: 'failed'})
                })
            );
        });

        it('should complete the session after handling error', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('fail-job-3');

            await svc.handleWorkerError(
                'fail-job-3', 'fail-job-3', mockSchedule, new Error('crash')
            );

            expect(sessionStore.hasSession('fail-job-3')).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // handleMfaRequired (private — accessed via type cast)
    // -------------------------------------------------------------------------

    describe('handleMfaRequired', () => {
        interface MockWorker {postMessage: ReturnType<typeof vi.fn>}
        interface InternalService {
            handleMfaRequired: (
                sessionId: string,
                scheduleId: string,
                jobId: string,
                prompt: string,
                worker: MockWorker,
                userId: string
            ) => Promise<void>;
        }

        it('should emit mfa_required SSE event and register MFA resolver', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('mfa-job');
            const received: string[] = [];
            sessionStore.getObservable('mfa-job').subscribe(e => received.push(e.data as string));
            const mockWorker: MockWorker = {postMessage: vi.fn()};

            await svc.handleMfaRequired('mfa-job', 'sched-1', 'mfa-job', 'Enter code', mockWorker, 'user-1');

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'mfa_required',
                        mfaChallenge: 'Enter code'
                    })
                })
            );
            expect(received.some(d => d.includes('mfa_required'))).toBe(true);
            expect(sessionStore.hasPendingMfa('mfa-job')).toBe(true);
            expect(pushService.sendNotification).toHaveBeenCalledWith(
                'user-1',
                'MFA Required',
                'Enter code',
                'http://localhost:3002/mfa?scheduleId=sched-1&sessionId=mfa-job'
            );
        });

        it('should post mfa_code back to worker when resolver is called', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('mfa-job-2');
            const mockWorker: MockWorker = {postMessage: vi.fn()};

            await svc.handleMfaRequired('mfa-job-2', 'sched-1', 'mfa-job-2', 'code prompt', mockWorker, 'user-1');
            sessionStore.resolveMfa('mfa-job-2', '654321');

            expect(mockWorker.postMessage).toHaveBeenCalledWith({
                type: 'mfa_code',
                code: '654321'
            });
        });

        it('should log a warning and not throw when worker.postMessage throws a non-Error value', async () => {
            // Covers the `String(postErr)` branch (line 206) — reached when the MFA
            // code is submitted after the worker has already been terminated and the
            // throw value is a primitive (e.g. a string), not an Error instance.
            const svc = service as unknown as InternalService;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const warnSpy = vi.spyOn((service as any).logger, 'warn');
            sessionStore.createSession('mfa-nonerror-job');
            const brokenWorker: MockWorker = {
                postMessage: vi.fn().mockImplementation(() => {
                    // eslint-disable-next-line @typescript-eslint/only-throw-error
                    throw 'worker already dead';
                })
            };

            await svc.handleMfaRequired('mfa-nonerror-job', 'sched-1', 'mfa-nonerror-job', 'Enter code', brokenWorker, 'user-1');

            // Resolver fires postMessage → non-Error thrown → catch block logs and swallows
            // The not.toThrow() wrapper confirms the catch block prevents propagation to the caller
            expect(() => sessionStore.resolveMfa('mfa-nonerror-job', '999999')).not.toThrow();
            expect(brokenWorker.postMessage).toHaveBeenCalledWith({type: 'mfa_code', code: '999999'});
            // The non-Error primitive must be stringified in the warn message
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('worker already dead')
            );
        });
    });

    // -------------------------------------------------------------------------
    // handleWorkerMessage (private — accessed via type cast)
    // -------------------------------------------------------------------------

    describe('handleWorkerMessage', () => {
        interface MockWorker {postMessage: ReturnType<typeof vi.fn>}
        interface InternalService {
            handleWorkerMessage: (
                sessionId: string,
                jobId: string,
                schedule: SyncSchedule,
                msg: unknown,
                worker: MockWorker
            ) => Promise<void>;
        }

        it('should emit status event for status messages', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('wm-1');
            const received: string[] = [];
            sessionStore.getObservable('wm-1').subscribe(e => received.push(e.data as string));

            await svc.handleWorkerMessage(
                'wm-1', 'wm-1', mockSchedule,
                {type: 'status', status: 'importing', message: 'Downloading transactions...'},
                {postMessage: vi.fn()}
            );

            expect(received.some(d => d.includes('importing'))).toBe(true);
        });

        it('should call handleMfaRequired for mfa_required messages', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('wm-2');
            const mockWorker: MockWorker = {postMessage: vi.fn()};

            await svc.handleWorkerMessage(
                'wm-2', 'wm-2', mockSchedule,
                {type: 'mfa_required', prompt: 'Give MFA code'},
                mockWorker
            );

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({status: 'mfa_required'})
                })
            );
        });

        it('should call handleResult for result messages', async () => {
            const svc = service as unknown as InternalService;
            sessionStore.createSession('wm-3');

            await svc.handleWorkerMessage(
                'wm-3', 'wm-3', mockSchedule,
                {type: 'result', transactions: [], importedCount: 0, skippedCount: 0},
                {postMessage: vi.fn()}
            );

            expect(prisma.syncJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({status: 'complete'})
                })
            );
        });
    });
});
