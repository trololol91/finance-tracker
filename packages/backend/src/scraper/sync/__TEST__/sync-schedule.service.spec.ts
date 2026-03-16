import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {
    BadRequestException, NotFoundException, ForbiddenException, ConflictException
} from '@nestjs/common';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import {SyncScheduleService} from '#scraper/sync/sync-schedule.service.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {CryptoService} from '#scraper/crypto/crypto.service.js';
import type {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {SchedulerRegistry} from '@nestjs/schedule';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockScraper: BankScraper = {
    bankId: 'cibc',
    displayName: 'CIBC',
    requiresMfaOnEveryRun: true,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    inputSchema: [],
    login: vi.fn(),
    scrapeTransactions: vi.fn()
};

const mockScheduleBase = {
    id: 'sched-uuid-1',
    userId: 'user-uuid-1',
    accountId: 'acct-uuid-1',
    bankId: 'cibc',
    pluginConfigEnc: 'encrypted:data',
    cron: '0 8 * * *',
    enabled: true,
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessfulSyncAt: null,
    lookbackDays: 3,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15')
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncScheduleService', () => {
    let service: SyncScheduleService;
    let prisma: PrismaService;
    let scraperRegistry: ScraperRegistry;
    let cryptoService: CryptoService;
    let schedulerRegistry: SchedulerRegistry;

    const userId = 'user-uuid-1';

    beforeEach(() => {
        prisma = {
            syncSchedule: {
                findMany: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn()
            },
            account: {
                findFirst: vi.fn()
            },
            syncJob: {
                deleteMany: vi.fn()
            }
        } as unknown as PrismaService;
        scraperRegistry = {
            findByBankId: vi.fn(),
            has: vi.fn(),
            listAll: vi.fn()
        } as unknown as ScraperRegistry;

        cryptoService = {
            encrypt: vi.fn(),
            decrypt: vi.fn()
        } as unknown as CryptoService;

        schedulerRegistry = {
            addCronJob: vi.fn(),
            deleteCronJob: vi.fn(),
            getCronJob: vi.fn(),
            hasCronJob: vi.fn()
        } as unknown as SchedulerRegistry;

        service = new SyncScheduleService(
            prisma, scraperRegistry, cryptoService, schedulerRegistry
        );
        vi.clearAllMocks();

        // Default mocks
        vi.mocked(scraperRegistry.findByBankId).mockReturnValue(mockScraper);
        vi.mocked(scraperRegistry.listAll).mockReturnValue([{
            bankId: 'cibc',
            displayName: 'CIBC',
            requiresMfaOnEveryRun: true,
            maxLookbackDays: 90,
            pendingTransactionsIncluded: false,
            inputSchema: []
        }]);
        vi.mocked(cryptoService.encrypt).mockReturnValue('encrypted:data');
        vi.mocked(cryptoService.decrypt).mockReturnValue(
            JSON.stringify({username: 'user1', password: 'pass1'})
        );
    });

    // -------------------------------------------------------------------------
    // findAll
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('should return all schedules for the user', async () => {
            vi.mocked(prisma.syncSchedule.findMany).mockResolvedValue([mockScheduleBase]);

            const result = await service.findAll(userId);

            expect(result).toHaveLength(1);
            expect(result[0].bankId).toBe('cibc');
            expect(result[0].displayName).toBe('CIBC');
        });

        it('should return empty array when user has no schedules', async () => {
            vi.mocked(prisma.syncSchedule.findMany).mockResolvedValue([]);

            const result = await service.findAll(userId);

            expect(result).toEqual([]);
        });

        it('should use fallback displayName when scraper not found', async () => {
            vi.mocked(prisma.syncSchedule.findMany).mockResolvedValue([mockScheduleBase]);
            vi.mocked(scraperRegistry.findByBankId).mockReturnValue(undefined);

            const result = await service.findAll(userId);

            expect(result[0].displayName).toContain('Unknown');
            expect(result[0].displayName).toContain('cibc');
        });
    });

    // -------------------------------------------------------------------------
    // findOne
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('should return a single schedule', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(mockScheduleBase);

            const result = await service.findOne(userId, mockScheduleBase.id);

            expect(result.id).toBe(mockScheduleBase.id);
            expect(result.displayName).toBe('CIBC');
        });

        it('should throw NotFoundException for unknown schedule', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(null);

            await expect(service.findOne(userId, 'nonexistent-id')).rejects.toThrow(
                NotFoundException
            );
        });

        it('should use fallback displayName when scraper not registered for findOne', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(mockScheduleBase);
            vi.mocked(scraperRegistry.findByBankId).mockReturnValue(undefined);

            const result = await service.findOne(userId, mockScheduleBase.id);

            expect(result.displayName).toContain('Unknown');
            expect(result.displayName).toContain('cibc');
        });
    });

    // -------------------------------------------------------------------------
    // create
    // -------------------------------------------------------------------------

    describe('create', () => {
        const dto = {
            accountId: 'acct-uuid-1',
            bankId: 'cibc',
            inputs: {username: 'user1', password: 'pass1'},
            cron: '0 8 * * *'
        };

        beforeEach(() => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue({id: 'acct-uuid-1'} as never);
            vi.mocked(prisma.syncSchedule.create).mockResolvedValue(mockScheduleBase);
        });

        it('should create a schedule and register a cron job', async () => {
            const result = await service.create(userId, dto);

            expect(result.id).toBe(mockScheduleBase.id);
            expect(cryptoService.encrypt).toHaveBeenCalledWith(
                JSON.stringify({username: 'user1', password: 'pass1'})
            );
            expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
                `sync-${mockScheduleBase.id}`,
                expect.anything()
            );
        });

        it('should throw BadRequestException for unknown bankId', async () => {
            vi.mocked(scraperRegistry.findByBankId).mockReturnValue(undefined);

            await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
            await expect(service.create(userId, dto)).rejects.toThrow('Unknown bankId');
        });

        it('should throw NotFoundException when accountId does not belong to user', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

            await expect(service.create(userId, dto)).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException for invalid cron expression', async () => {
            const badCronDto = {...dto, cron: 'not-a-cron'};
            await expect(service.create(userId, badCronDto)).rejects.toThrow(BadRequestException);
            await expect(service.create(userId, badCronDto)).rejects.toThrow('Invalid cron expression');
        });

        it('should throw ConflictException on P2002 unique constraint', async () => {
            const p2002 = new PrismaClientKnownRequestError('Unique constraint', {
                code: 'P2002',
                clientVersion: '7.0.0'
            });
            vi.mocked(prisma.syncSchedule.create).mockRejectedValue(p2002);

            await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
        });

        it('should use default lookbackDays of 3 when not provided', async () => {
            await service.create(userId, dto);

            expect(prisma.syncSchedule.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({lookbackDays: 3})
                })
            );
        });

        it('should use custom lookbackDays when provided', async () => {
            await service.create(userId, {...dto, lookbackDays: 7});

            expect(prisma.syncSchedule.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({lookbackDays: 7})
                })
            );
        });

        it('should rethrow non-P2002 errors from prisma.syncSchedule.create', async () => {
            const dbError = new PrismaClientKnownRequestError('FK violation', {
                code: 'P2003',
                clientVersion: '7.0.0'
            });
            vi.mocked(prisma.syncSchedule.create).mockRejectedValue(dbError);

            await expect(service.create(userId, dto)).rejects.toThrow(dbError);
        });
    });

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    describe('update', () => {
        beforeEach(() => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(mockScheduleBase);
            vi.mocked(prisma.syncSchedule.update).mockResolvedValue(mockScheduleBase);
        });

        it('should update the cron expression and re-register cron job', async () => {
            const updated = {...mockScheduleBase, cron: '0 20 * * *'};
            vi.mocked(prisma.syncSchedule.update).mockResolvedValue(updated);

            const result = await service.update(userId, mockScheduleBase.id, {cron: '0 20 * * *'});

            expect(result.cron).toBe('0 20 * * *');
            expect(schedulerRegistry.deleteCronJob).toHaveBeenCalled();
            expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
        });

        it('should throw BadRequestException for invalid cron in update', async () => {
            await expect(
                service.update(userId, mockScheduleBase.id, {cron: 'bad-cron'})
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException when schedule not found', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(null);

            await expect(service.update(userId, 'not-found', {})).rejects.toThrow(
                NotFoundException
            );
        });

        it('should re-encrypt plugin inputs when inputs is provided', async () => {
            vi.mocked(cryptoService.decrypt).mockReturnValue(
                JSON.stringify({username: 'user1', password: 'pass1'})
            );

            await service.update(userId, mockScheduleBase.id, {
                inputs: {password: 'newpass'}
            });

            expect(cryptoService.decrypt).toHaveBeenCalled();
            expect(cryptoService.encrypt).toHaveBeenCalledWith(
                JSON.stringify({username: 'user1', password: 'newpass'})
            );
        });

        it('should re-encrypt plugin inputs when only username is updated', async () => {
            vi.mocked(cryptoService.decrypt).mockReturnValue(
                JSON.stringify({username: 'user1', password: 'pass1'})
            );

            await service.update(userId, mockScheduleBase.id, {
                inputs: {username: 'newuser'}
            });

            expect(cryptoService.decrypt).toHaveBeenCalled();
            expect(cryptoService.encrypt).toHaveBeenCalledWith(
                JSON.stringify({username: 'newuser', password: 'pass1'})
            );
        });

        it('should not re-register cron job when cron is not changed', async () => {
            await service.update(userId, mockScheduleBase.id, {lookbackDays: 7});

            expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalled();
            expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
        });

        it('should not re-register cron job when cron changes but schedule is disabled', async () => {
            const disabled = {...mockScheduleBase, enabled: false};
            vi.mocked(prisma.syncSchedule.update).mockResolvedValue(disabled);

            await service.update(userId, mockScheduleBase.id, {cron: '0 20 * * *'});

            expect(schedulerRegistry.deleteCronJob).toHaveBeenCalled();
            expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException on P2025 race condition in update', async () => {
            const p2025 = new PrismaClientKnownRequestError('Not found', {
                code: 'P2025',
                clientVersion: '7.0.0'
            });
            vi.mocked(prisma.syncSchedule.update).mockRejectedValue(p2025);

            await expect(
                service.update(userId, mockScheduleBase.id, {lookbackDays: 7})
            ).rejects.toThrow(NotFoundException);
        });

        it('should rethrow non-P2025 errors from prisma.syncSchedule.update', async () => {
            const dbError = new Error('Database connection lost');
            vi.mocked(prisma.syncSchedule.update).mockRejectedValue(dbError);

            await expect(
                service.update(userId, mockScheduleBase.id, {lookbackDays: 7})
            ).rejects.toThrow(dbError);
        });

        it('should use unknownScraperFallback in response when bankId leaves registry after update', async () => {
            // Covers the `?? this.unknownScraperFallback(...)` branch (line 274) in update().
            // All other update() tests have scraperRegistry.findByBankId returning mockScraper,
            // so the ?? branch is never taken without this test.
            vi.mocked(scraperRegistry.findByBankId).mockReturnValueOnce(undefined);

            const result = await service.update(userId, mockScheduleBase.id, {lookbackDays: 7});

            expect(result.displayName).toContain('Unknown');
            expect(result.displayName).toContain('cibc');
        });
    });

    // -------------------------------------------------------------------------
    // remove
    // -------------------------------------------------------------------------

    describe('remove', () => {
        beforeEach(() => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(mockScheduleBase);
            vi.mocked(prisma.syncSchedule.delete).mockResolvedValue(mockScheduleBase);
            vi.mocked(prisma.syncJob.deleteMany).mockResolvedValue({count: 0});
        });

        it('should delete the schedule and remove the cron job', async () => {
            await service.remove(userId, mockScheduleBase.id);

            expect(prisma.syncJob.deleteMany).toHaveBeenCalledWith({
                where: {syncScheduleId: mockScheduleBase.id}
            });
            expect(prisma.syncSchedule.delete).toHaveBeenCalled();
            expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
                `sync-${mockScheduleBase.id}`
            );
        });

        it('should throw NotFoundException when schedule not found', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(null);

            await expect(service.remove(userId, 'not-found')).rejects.toThrow(NotFoundException);
        });

        it('should silently handle missing cron job when deleting a disabled schedule', async () => {
            vi.mocked(schedulerRegistry.deleteCronJob).mockImplementation(() => {
                throw new Error('Cron job not found');
            });

            await expect(service.remove(userId, mockScheduleBase.id)).resolves.not.toThrow();
        });

        it('should rethrow non-P2025 errors from prisma.syncSchedule.delete', async () => {
            const dbError = new Error('Database connection lost');
            vi.mocked(prisma.syncSchedule.delete).mockRejectedValue(dbError);

            await expect(service.remove(userId, mockScheduleBase.id)).rejects.toThrow(dbError);
        });

        it('should rethrow errors thrown by prisma.syncJob.deleteMany', async () => {
            const dbError = new Error('DB connection lost during child delete');
            vi.mocked(prisma.syncJob.deleteMany).mockRejectedValue(dbError);

            await expect(service.remove(userId, mockScheduleBase.id)).rejects.toThrow(dbError);
            // syncSchedule.delete must not be called if deleteMany already threw
            expect(prisma.syncSchedule.delete).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException when P2025 race condition occurs in syncSchedule.delete', async () => {
            // Covers the catch(P2025) branch in remove() (line 211) — triggered when the
            // schedule is deleted by another request between findFirst and delete.
            const p2025 = new PrismaClientKnownRequestError('Record to delete not found', {
                code: 'P2025',
                clientVersion: '7.0.0'
            });
            vi.mocked(prisma.syncSchedule.delete).mockRejectedValue(p2025);

            await expect(
                service.remove(userId, mockScheduleBase.id)
            ).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // reRegisterCronJob
    // -------------------------------------------------------------------------

    describe('reRegisterCronJob', () => {
        const scheduleId = 'sched-uuid-1';
        const cron = '0 8 * * *';
        const name = `sync-${scheduleId}`;

        it('should attempt to delete the stale job before adding the new one', () => {
            service.reRegisterCronJob(scheduleId, cron);

            const deleteOrder =
                vi.mocked(schedulerRegistry.deleteCronJob).mock.invocationCallOrder[0];
            const addOrder =
                vi.mocked(schedulerRegistry.addCronJob).mock.invocationCallOrder[0];
            expect(deleteOrder).toBeLessThan(addOrder);
        });

        it('should delete the stale job using the sync-{id} naming convention', () => {
            service.reRegisterCronJob(scheduleId, cron);

            expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(name);
        });

        it('should swallow a deletion error and still add the new job (first boot)', () => {
            vi.mocked(schedulerRegistry.deleteCronJob).mockImplementation(() => {
                throw new Error(`Cron job ${name} not found`);
            });

            // Must not throw
            expect(() => { service.reRegisterCronJob(scheduleId, cron); }).not.toThrow();

            // New job must still be registered despite the deletion failure
            expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(name, expect.anything());
        });

        it('should register the new cron job under the sync-{id} key', () => {
            service.reRegisterCronJob(scheduleId, cron);

            expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(name, expect.anything());
        });

        // job.start() is called on the real CronJob instance returned by `new CronJob(...)`.
        // The constructor callback body is excluded from coverage via `/* v8 ignore next 6 */`
        // in sync-schedule.service.ts, so no CronJob mock is needed here to reach 100% coverage.
    });

    // -------------------------------------------------------------------------
    // unknownScraperFallback (private — accessed via type cast)
    // -------------------------------------------------------------------------

    describe('unknownScraperFallback', () => {
        interface InternalService {
            unknownScraperFallback: (bankId: string) => {
                bankId: string;
                displayName: string;
                login: () => Promise<void>;
                scrapeTransactions: () => Promise<never[]>;
            };
        }
        // Use a consistent bankId throughout this block
        const fallbackBankId = 'unknown-bank';

        it('should return correct metadata and a login() stub that resolves without a value', async () => {
            const svc = service as unknown as InternalService;
            const fallback = svc.unknownScraperFallback(fallbackBankId);
            expect(fallback.bankId).toBe(fallbackBankId);
            expect(fallback.displayName).toBe(`Unknown (${fallbackBankId})`);
            await expect(fallback.login()).resolves.toBeUndefined();
        });

        it('should return a scrapeTransactions() stub that resolves to an empty array', async () => {
            const svc = service as unknown as InternalService;
            const fallback = svc.unknownScraperFallback(fallbackBankId);
            await expect(fallback.scrapeTransactions()).resolves.toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // assertOwnership
    // -------------------------------------------------------------------------

    describe('assertOwnership', () => {
        it('should not throw when owner is correct', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(mockScheduleBase);

            await expect(
                service.assertOwnership(userId, mockScheduleBase.id)
            ).resolves.not.toThrow();
        });

        it('should throw NotFoundException when schedule not found', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue(null);

            await expect(service.assertOwnership(userId, 'not-found')).rejects.toThrow(
                NotFoundException
            );
        });

        it('should throw ForbiddenException when user does not own the schedule', async () => {
            vi.mocked(prisma.syncSchedule.findFirst).mockResolvedValue({
                ...mockScheduleBase,
                userId: 'other-user'
            });

            await expect(service.assertOwnership(userId, mockScheduleBase.id)).rejects.toThrow(
                ForbiddenException
            );
        });
    });
});
