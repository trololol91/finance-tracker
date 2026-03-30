import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import type {MessageEvent} from '@nestjs/common';
import {of} from 'rxjs';
import type {Observable} from 'rxjs';
import {SyncJobController} from '#scraper/sync/sync-job.controller.js';
import type {ScraperService} from '#scraper/scraper.service.js';
import type {SyncSessionStore} from '#scraper/sync-session.store.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {User} from '#generated/prisma/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed',
    firstName: 'Jane',
    lastName: 'Smith',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'USD',
    role: 'USER',
    notifyEmail: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

const SESSION_ID = 'session-uuid-1';
const SCHEDULE_ID = 'sched-uuid-1';

const mockSyncJob = {
    id: SESSION_ID,
    userId: mockUser.id,
    syncScheduleId: SCHEDULE_ID,
    triggeredBy: 'manual',
    status: 'running',
    message: null,
    mfaChallenge: null,
    importedCount: 0,
    skippedCount: 0,
    errorMessage: null,
    requestStartDate: null,
    requestEndDate: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15')
};

const mockObservable: Observable<MessageEvent> = of(
    {data: JSON.stringify({status: 'running'})} as MessageEvent
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncJobController', () => {
    let controller: SyncJobController;
    let scraperService: ScraperService;
    let sessionStore: SyncSessionStore;
    let prisma: PrismaService;

    beforeEach(() => {
        scraperService = {
            sync: vi.fn(),
            cancelMfa: vi.fn()
        } as unknown as ScraperService;

        sessionStore = {
            getObservable: vi.fn(),
            hasSession: vi.fn(),
            hasPendingMfa: vi.fn(),
            resolveMfa: vi.fn()
        } as unknown as SyncSessionStore;

        prisma = {
            syncJob: {
                findUnique: vi.fn()
            }
        } as unknown as PrismaService;

        controller = new SyncJobController(scraperService, sessionStore, prisma);
    });

    // -------------------------------------------------------------------------
    // POST /:id/run-now
    // -------------------------------------------------------------------------

    describe('runNow', () => {
        it('should call scraperService.sync and return sessionId', async () => {
            vi.mocked(scraperService.sync).mockResolvedValue({sessionId: SESSION_ID});
            const dto = {};

            const result = await controller.runNow(SCHEDULE_ID, dto, mockUser);

            expect(scraperService.sync).toHaveBeenCalledWith(
                mockUser.id,
                SCHEDULE_ID,
                'manual',
                undefined,
                false
            );
            expect(result).toEqual({sessionId: SESSION_ID});
        });

        it('should pass startDate override when provided', async () => {
            vi.mocked(scraperService.sync).mockResolvedValue({sessionId: SESSION_ID});
            const dto = {startDate: '2025-01-01T00:00:00.000Z'};

            await controller.runNow(SCHEDULE_ID, dto, mockUser);

            expect(scraperService.sync).toHaveBeenCalledWith(
                mockUser.id,
                SCHEDULE_ID,
                'manual',
                '2025-01-01T00:00:00.000Z',
                false
            );
        });

        it('should pass dryRun: true when dto.dryRun is true', async () => {
            vi.mocked(scraperService.sync).mockResolvedValue({sessionId: SESSION_ID});
            const dto = {dryRun: true};

            await controller.runNow(SCHEDULE_ID, dto, mockUser);

            expect(scraperService.sync).toHaveBeenCalledWith(
                mockUser.id,
                SCHEDULE_ID,
                'manual',
                undefined,
                true
            );
        });

        it('should pass dryRun: false when dto.dryRun is explicitly false', async () => {
            vi.mocked(scraperService.sync).mockResolvedValue({sessionId: SESSION_ID});
            const dto = {dryRun: false};

            await controller.runNow(SCHEDULE_ID, dto, mockUser);

            expect(scraperService.sync).toHaveBeenCalledWith(
                mockUser.id,
                SCHEDULE_ID,
                'manual',
                undefined,
                false
            );
        });

        it('should propagate NotFoundException from scraperService', async () => {
            vi.mocked(scraperService.sync).mockRejectedValue(
                new NotFoundException('Sync schedule not found')
            );

            await expect(controller.runNow(SCHEDULE_ID, {}, mockUser)).rejects.toThrow(
                NotFoundException
            );
        });
    });

    // -------------------------------------------------------------------------
    // GET /:id/stream
    // -------------------------------------------------------------------------

    describe('stream', () => {
        it('should throw NotFoundException when job does not exist', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(null);

            await expect(controller.stream(SESSION_ID, mockUser)).rejects.toThrow(
                NotFoundException
            );
        });

        it('should throw NotFoundException when job belongs to different user', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockSyncJob,
                userId: 'other-user-uuid'
            } as typeof mockSyncJob);

            await expect(controller.stream(SESSION_ID, mockUser)).rejects.toThrow(
                NotFoundException
            );
        });

        it('should throw NotFoundException when session is not active and job is not terminal', async () => {
            // status 'running' with no in-memory session — abnormal state, still 404
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(
                mockSyncJob // status: 'running'
            );
            vi.mocked(sessionStore.hasSession).mockReturnValue(false);

            await expect(controller.stream(SESSION_ID, mockUser)).rejects.toThrow(
                NotFoundException
            );
        });

        it('should replay complete event when session already cleaned up and job is complete (race condition)', async () => {
            // Race: stub scraper finished before frontend connected to /stream
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockSyncJob,
                status: 'complete',
                importedCount: 3,
                skippedCount: 1
            } as typeof mockSyncJob);
            vi.mocked(sessionStore.hasSession).mockReturnValue(false);

            const result = await controller.stream(SESSION_ID, mockUser);

            // Should NOT call getObservable — session is gone
            expect(sessionStore.getObservable).not.toHaveBeenCalled();

            // The returned observable should emit the terminal complete event
            await new Promise<void>((resolve, reject) => {
                const events: MessageEvent[] = [];
                result.subscribe({
                    next: (e) => events.push(e),
                    error: (err: unknown) => { reject(err as Error); },
                    complete: () => {
                        expect(events).toHaveLength(1);
                        const raw = JSON.parse(events[0].data as string) as Record<string, unknown>;
                        expect(raw.status).toBe('complete');
                        expect(raw.importedCount).toBe(3);
                        expect(raw.skippedCount).toBe(1);
                        resolve();
                    }
                });
            });
        });

        it('should replay failed event when session already cleaned up and job failed (race condition)', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockSyncJob,
                status: 'failed',
                errorMessage: 'Login rejected'
            } as unknown as typeof mockSyncJob);
            vi.mocked(sessionStore.hasSession).mockReturnValue(false);

            const result = await controller.stream(SESSION_ID, mockUser);

            expect(sessionStore.getObservable).not.toHaveBeenCalled();

            await new Promise<void>((resolve, reject) => {
                const events: MessageEvent[] = [];
                result.subscribe({
                    next: (e) => events.push(e),
                    error: (err: unknown) => { reject(err as Error); },
                    complete: () => {
                        expect(events).toHaveLength(1);
                        const raw = JSON.parse(events[0].data as string) as Record<string, unknown>;
                        expect(raw.status).toBe('failed');
                        expect(raw.errorMessage).toBe('Login rejected');
                        resolve();
                    }
                });
            });
        });

        it('should use fallback error message "Sync failed" when job errorMessage is null (race condition)', async () => {
            // Exercises the `job.errorMessage ?? 'Sync failed'` null-coalescing branch
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockSyncJob,
                status: 'failed',
                errorMessage: null
            } as typeof mockSyncJob);
            vi.mocked(sessionStore.hasSession).mockReturnValue(false);

            const result = await controller.stream(SESSION_ID, mockUser);

            expect(sessionStore.getObservable).not.toHaveBeenCalled();

            await new Promise<void>((resolve, reject) => {
                const events: MessageEvent[] = [];
                result.subscribe({
                    next: (e) => events.push(e),
                    error: (err: unknown) => { reject(err as Error); },
                    complete: () => {
                        expect(events).toHaveLength(1);
                        const raw = JSON.parse(events[0].data as string) as Record<string, unknown>;
                        expect(raw.status).toBe('failed');
                        expect(raw.errorMessage).toBe('Sync failed');
                        resolve();
                    }
                });
            });
        });

        it('should return observable when job is owned and session is active', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(
                mockSyncJob
            );
            vi.mocked(sessionStore.hasSession).mockReturnValue(true);
            vi.mocked(sessionStore.getObservable).mockReturnValue(mockObservable);

            const result = await controller.stream(SESSION_ID, mockUser);

            expect(result).toBe(mockObservable);
            expect(sessionStore.hasSession).toHaveBeenCalledWith(SESSION_ID);
            expect(sessionStore.getObservable).toHaveBeenCalledWith(SESSION_ID);
        });
    });

    // -------------------------------------------------------------------------
    // POST /:id/mfa-response
    // -------------------------------------------------------------------------

    describe('mfaResponse', () => {
        it('should throw NotFoundException when job does not exist', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(null);

            await expect(
                controller.mfaResponse(SESSION_ID, {code: '123456'}, mockUser)
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException when job belongs to different user', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockSyncJob,
                userId: 'other-user-uuid'
            } as typeof mockSyncJob);

            await expect(
                controller.mfaResponse(SESSION_ID, {code: '123456'}, mockUser)
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when no pending MFA challenge', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(
                mockSyncJob
            );
            vi.mocked(sessionStore.hasPendingMfa).mockReturnValue(false);

            await expect(
                controller.mfaResponse(SESSION_ID, {code: '123456'}, mockUser)
            ).rejects.toThrow(BadRequestException);
        });

        it('should resolve MFA and return {ok: true} when challenge is pending', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(
                mockSyncJob
            );
            vi.mocked(sessionStore.hasPendingMfa).mockReturnValue(true);
            vi.mocked(sessionStore.resolveMfa).mockReturnValue(true);

            const result = await controller.mfaResponse(
                SESSION_ID,
                {code: '123456'},
                mockUser
            );

            expect(sessionStore.resolveMfa).toHaveBeenCalledWith(SESSION_ID, '123456');
            expect(result).toEqual({ok: true});
        });

        it('should pass through the exact MFA code to resolveMfa', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(
                mockSyncJob
            );
            vi.mocked(sessionStore.hasPendingMfa).mockReturnValue(true);
            vi.mocked(sessionStore.resolveMfa).mockReturnValue(true);

            await controller.mfaResponse(SESSION_ID, {code: 'TOKEN-XYZ'}, mockUser);

            expect(sessionStore.resolveMfa).toHaveBeenCalledWith(SESSION_ID, 'TOKEN-XYZ');
        });
    });

    // -------------------------------------------------------------------------
    // POST /:id/cancel-mfa
    // -------------------------------------------------------------------------

    describe('cancelMfa', () => {
        it('should call scraperService.cancelMfa and return {ok: true}', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(mockSyncJob);
            vi.mocked(scraperService.cancelMfa).mockResolvedValue(undefined);

            const result = await controller.cancelMfa(SESSION_ID, mockUser);

            expect(scraperService.cancelMfa).toHaveBeenCalledWith(SESSION_ID);
            expect(result).toEqual({ok: true});
        });

        it('should throw NotFoundException when job not found', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue(null);

            await expect(controller.cancelMfa(SESSION_ID, mockUser)).rejects.toThrow(
                NotFoundException
            );
        });

        it('should throw NotFoundException when job belongs to different user', async () => {
            vi.mocked(prisma.syncJob.findUnique).mockResolvedValue({
                ...mockSyncJob,
                userId: 'other-user-uuid'
            } as typeof mockSyncJob);

            await expect(controller.cancelMfa(SESSION_ID, mockUser)).rejects.toThrow(
                NotFoundException
            );
        });
    });
});
