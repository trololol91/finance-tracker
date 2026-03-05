import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {ScraperScheduler} from '#scraper/scraper.scheduler.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {SyncScheduleService} from '#scraper/sync/sync-schedule.service.js';
import type {SchedulerRegistry} from '@nestjs/schedule';

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
    let mockSchedulerRegistry: {deleteCronJob: ReturnType<typeof vi.fn>};
    let mockSyncScheduleService: {reRegisterCronJob: ReturnType<typeof vi.fn>};

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = {syncSchedule: {findMany: vi.fn()}};
        mockSchedulerRegistry = {deleteCronJob: vi.fn()};
        mockSyncScheduleService = {reRegisterCronJob: vi.fn()};
        scheduler = new ScraperScheduler(
            mockPrisma as unknown as PrismaService,
            mockSchedulerRegistry as unknown as SchedulerRegistry,
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
            expect(mockSchedulerRegistry.deleteCronJob).not.toHaveBeenCalled();
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

        it('should build the stale-deletion key as sync-{id}', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([
                makeSchedule({id: 'abc-123'})
            ]);

            await scheduler.onModuleInit();

            // The stale-guard must use the same naming convention as SyncScheduleService
            expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalledWith('sync-abc-123');
        });

        it('should attempt stale deletion before calling reRegisterCronJob', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([
                makeSchedule({id: 'sched-1', cron: '0 8 * * *'})
            ]);

            await scheduler.onModuleInit();

            const deleteOrder =
                mockSchedulerRegistry.deleteCronJob.mock.invocationCallOrder[0];
            const registerOrder =
                mockSyncScheduleService.reRegisterCronJob.mock.invocationCallOrder[0];
            expect(deleteOrder).toBeLessThan(registerOrder);
        });

        it(
            'should silently swallow a stale deletion error and still call reRegisterCronJob',
            async () => {
                mockPrisma.syncSchedule.findMany.mockResolvedValue([
                    makeSchedule({id: 'sched-1', cron: '0 8 * * *'})
                ]);
                // SchedulerRegistry throws when the key does not exist — normal on first boot
                mockSchedulerRegistry.deleteCronJob.mockImplementation(() => {
                    throw new Error('Cron job sync-sched-1 not found');
                });

                // Must not throw even though deleteCronJob throws
                await expect(scheduler.onModuleInit()).resolves.toBeUndefined();

                // The job must still be registered despite the deletion failure
                expect(mockSyncScheduleService.reRegisterCronJob).toHaveBeenCalledOnce();
            }
        );

        it('should propagate unexpected database errors to the caller', async () => {
            mockPrisma.syncSchedule.findMany.mockRejectedValue(
                new Error('DB connection lost')
            );

            await expect(scheduler.onModuleInit()).rejects.toThrow('DB connection lost');
        });
    });
});
