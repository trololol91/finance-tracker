import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {CronJob} from 'cron';
import {ScraperScheduler} from '#scraper/scraper.scheduler.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {SchedulerRegistry} from '@nestjs/schedule';

// ---------------------------------------------------------------------------
// Cron mock — prevents real CronJob timers from running during tests.
// mockImplementation is re-applied each beforeEach so vi.clearAllMocks()
// does not leave the constructor without a return value.
// ---------------------------------------------------------------------------

vi.mock('cron', () => ({CronJob: vi.fn()}));

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
    let mockSchedulerRegistry: {
        addCronJob: ReturnType<typeof vi.fn>;
        deleteCronJob: ReturnType<typeof vi.fn>;
    };
    let cronJobStart: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Re-apply CronJob mock implementation after vi.clearAllMocks() wipes it.
        // Each test gets a fresh start spy via the shared cronJobStart reference.
        // Arrow functions cannot be used as constructors — function keyword is required.
        cronJobStart = vi.fn();
        vi.mocked(CronJob).mockImplementation(
            // eslint-disable-next-line prefer-arrow-callback
            function() { return {start: cronJobStart} as unknown as CronJob; }
        );

        mockPrisma = {syncSchedule: {findMany: vi.fn()}};
        mockSchedulerRegistry = {
            addCronJob: vi.fn(),
            deleteCronJob: vi.fn()
        };
        scheduler = new ScraperScheduler(
            mockPrisma as unknown as PrismaService,
            mockSchedulerRegistry as unknown as SchedulerRegistry
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

            expect(mockSchedulerRegistry.addCronJob).not.toHaveBeenCalled();
            expect(cronJobStart).not.toHaveBeenCalled();
        });

        it('should register a cron job for each enabled schedule', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([
                makeSchedule({id: 'sched-1', cron: '0 8 * * *'}),
                makeSchedule({id: 'sched-2', cron: '0 20 * * *'})
            ]);

            await scheduler.onModuleInit();

            expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledTimes(2);
            expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith(
                'sync-sched-1',
                expect.objectContaining({start: cronJobStart})
            );
            expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith(
                'sync-sched-2',
                expect.objectContaining({start: cronJobStart})
            );
            // start() is called once per registered job
            expect(cronJobStart).toHaveBeenCalledTimes(2);
        });

        it('should use the sync-{id} naming convention for cron job keys', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([
                makeSchedule({id: 'abc-123'})
            ]);

            await scheduler.onModuleInit();

            expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith(
                'sync-abc-123',
                expect.anything()
            );
        });

        it('should attempt to remove a stale job before adding the new one', async () => {
            mockPrisma.syncSchedule.findMany.mockResolvedValue([
                makeSchedule({id: 'sched-1', cron: '0 8 * * *'})
            ]);

            await scheduler.onModuleInit();

            // deleteCronJob must be called with the same key before addCronJob
            expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalledWith('sync-sched-1');
            const deleteOrder =
                mockSchedulerRegistry.deleteCronJob.mock.invocationCallOrder[0];
            const addOrder =
                mockSchedulerRegistry.addCronJob.mock.invocationCallOrder[0];
            expect(deleteOrder).toBeLessThan(addOrder);
        });

        it(
            'should silently swallow a stale deletion error and still register the job',
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
                expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledOnce();
                expect(cronJobStart).toHaveBeenCalledOnce();
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
