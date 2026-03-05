import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {ScraperScheduler} from '#scraper/scraper.scheduler.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {SyncScheduleService} from '#scraper/sync/sync-schedule.service.js';

// ---------------------------------------------------------------------------
// No CronJob mock needed — ScraperScheduler delegates job construction to
// SyncScheduleService.reRegisterCronJob, which is mocked directly below.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ScheduleStub {
    id: string;
    cron: string;
}

const makeSchedule = (overrides?: Partial<ScheduleStub>): ScheduleStub => ({
    id: 'sched-uuid-1',
    cron: '0 8 * * *',
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScraperScheduler', () => {
    let scheduler: ScraperScheduler;
    let mockPrisma: {syncSchedule: {findMany: ReturnType<typeof vi.fn>}};
    let mockSyncScheduleService: {reRegisterCronJob: ReturnType<typeof vi.fn>};

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = {syncSchedule: {findMany: vi.fn()}};
        mockSyncScheduleService = {reRegisterCronJob: vi.fn()};
        scheduler = new ScraperScheduler(
            mockPrisma as unknown as PrismaService,
            mockSyncScheduleService as unknown as SyncScheduleService
        );
    });

    describe('onModuleInit', () => {
        it('should query only enabled=true schedules and select id + cron fields', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([]);

            await scheduler.onModuleInit();

            expect(mockPrisma.syncSchedule.findMany).toHaveBeenCalledWith({
                where: {enabled: true},
                select: {id: true, cron: true}
            });
        });

        it('should do nothing when there are no enabled schedules', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([]);

            await scheduler.onModuleInit();

            expect(mockSyncScheduleService.reRegisterCronJob).not.toHaveBeenCalled();
        });

        it('should call reRegisterCronJob on the service for each enabled schedule', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([
                makeSchedule({id: 'sched-1', cron: '0 8 * * *'}),
                makeSchedule({id: 'sched-2', cron: '0 20 * * *'})
            ]);

            await scheduler.onModuleInit();

            expect(mockSyncScheduleService.reRegisterCronJob).toHaveBeenCalledTimes(2);
            expect(mockSyncScheduleService.reRegisterCronJob).toHaveBeenCalledWith(
                'sched-1', '0 8 * * *'
            );
            expect(mockSyncScheduleService.reRegisterCronJob).toHaveBeenCalledWith(
                'sched-2', '0 20 * * *'
            );
        });

        it('should propagate unexpected database errors to the caller', async () => {
            mockPrisma.syncSchedule.findMany.mockRejectedValue(
                new Error('DB connection lost')
            );

            await expect(scheduler.onModuleInit()).rejects.toThrow('DB connection lost');
        });
    });
});
