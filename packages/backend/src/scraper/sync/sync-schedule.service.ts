import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    Logger
} from '@nestjs/common';
import {SchedulerRegistry} from '@nestjs/schedule';
import {CronJob} from 'cron';
import {isValidCron} from 'cron-validator';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import {PrismaService} from '#database/prisma.service.js';
import {CryptoService} from '#scraper/crypto/crypto.service.js';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import {CreateSyncScheduleDto} from '#scraper/sync/dto/create-sync-schedule.dto.js';
import {UpdateSyncScheduleDto} from '#scraper/sync/dto/update-sync-schedule.dto.js';
import {SyncScheduleResponseDto} from '#scraper/sync/dto/sync-schedule-response.dto.js';

@Injectable()
export class SyncScheduleService {
    private readonly logger = new Logger(SyncScheduleService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly scraperRegistry: ScraperRegistry,
        private readonly cryptoService: CryptoService,
        private readonly schedulerRegistry: SchedulerRegistry
    ) {}

    /** List all sync schedules for the authenticated user. */
    public async findAll(userId: string): Promise<SyncScheduleResponseDto[]> {
        const schedules = await this.prisma.syncSchedule.findMany({
            where: {userId},
            orderBy: {createdAt: 'desc'}
        });
        return schedules.map(s => {
            const scraper = this.scraperRegistry.findByBankId(s.bankId);
            if (!scraper) {
                this.logger.warn(`Registered scraper not found for bankId: ${s.bankId}`);
            }
            return SyncScheduleResponseDto.fromEntity(
                s,
                scraper ?? this.unknownScraperFallback(s.bankId)
            );
        });
    }

    /** Return a single schedule by ID, enforcing ownership. */
    public async findOne(userId: string, id: string): Promise<SyncScheduleResponseDto> {
        const schedule = await this.prisma.syncSchedule.findFirst({where: {id, userId}});
        if (!schedule) {
            throw new NotFoundException(`Sync schedule with ID ${id} not found`);
        }
        const scraper =
            this.scraperRegistry.findByBankId(schedule.bankId) ??
            this.unknownScraperFallback(schedule.bankId);
        return SyncScheduleResponseDto.fromEntity(schedule, scraper);
    }

    /** Create a new sync schedule and register its cron job. */
    public async create(
        userId: string,
        dto: CreateSyncScheduleDto
    ): Promise<SyncScheduleResponseDto> {
        // Validate bankId against registry
        const scraper = this.scraperRegistry.findByBankId(dto.bankId);
        if (!scraper) {
            throw new BadRequestException(
                `Unknown bankId '${dto.bankId}'. ` +
                    `Registered banks: ${this.scraperRegistry.listAll().map(s => s.bankId).join(', ')}`
            );
        }

        // Validate accountId ownership
        const account = await this.prisma.account.findFirst({
            where: {id: dto.accountId, userId}
        });
        if (!account) {
            throw new NotFoundException(`Account with ID ${dto.accountId} not found`);
        }

        // Validate cron expression
        if (!isValidCron(dto.cron, {seconds: false})) {
            throw new BadRequestException(`Invalid cron expression: '${dto.cron}'`);
        }

        // Encrypt credentials
        const credentialsEnc = this.cryptoService.encrypt(
            JSON.stringify({username: dto.username, password: dto.password})
        );

        try {
            const schedule = await this.prisma.syncSchedule.create({
                data: {
                    userId,
                    accountId: dto.accountId,
                    bankId: dto.bankId,
                    credentialsEnc,
                    cron: dto.cron,
                    lookbackDays: dto.lookbackDays ?? 3
                }
            });

            // Register the cron job in NestJS scheduler
            this.reRegisterCronJob(schedule.id, dto.cron);

            return SyncScheduleResponseDto.fromEntity(schedule, scraper);
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException(
                    'A sync schedule for this account already exists'
                );
            }
            this.logger.error('Failed to create sync schedule', err instanceof Error ? err.stack : undefined);
            throw err;
        }
    }

    /** Update an existing sync schedule. Re-encrypts credentials if password provided. */
    public async update(
        userId: string,
        id: string,
        dto: UpdateSyncScheduleDto
    ): Promise<SyncScheduleResponseDto> {
        const existing = await this.prisma.syncSchedule.findFirst({where: {id, userId}});
        if (!existing) {
            throw new NotFoundException(`Sync schedule with ID ${id} not found`);
        }

        // Validate cron if provided
        if (dto.cron !== undefined && !isValidCron(dto.cron, {seconds: false})) {
            throw new BadRequestException(`Invalid cron expression: '${dto.cron}'`);
        }

        // Re-encrypt credentials if password provided
        let credentialsEnc: string | undefined;
        if (dto.password !== undefined) {
            const existing_creds = JSON.parse(
                this.cryptoService.decrypt(existing.credentialsEnc)
            ) as {username: string, password: string};
            credentialsEnc = this.cryptoService.encrypt(
                JSON.stringify({
                    username: dto.username ?? existing_creds.username,
                    password: dto.password
                })
            );
        } else if (dto.username !== undefined) {
            // Username changed but no new password — re-encrypt with new username
            const existing_creds = JSON.parse(
                this.cryptoService.decrypt(existing.credentialsEnc)
            ) as {username: string, password: string};
            credentialsEnc = this.cryptoService.encrypt(
                JSON.stringify({
                    username: dto.username,
                    password: existing_creds.password
                })
            );
        }

        try {
            const updated = await this.prisma.syncSchedule.update({
                where: {id},
                data: {
                    ...(credentialsEnc !== undefined && {credentialsEnc}),
                    ...(dto.cron !== undefined && {cron: dto.cron}),
                    ...(dto.lookbackDays !== undefined && {lookbackDays: dto.lookbackDays}),
                    ...(dto.enabled !== undefined && {enabled: dto.enabled})
                }
            });

            // Update cron job if cron expression changed
            if (dto.cron !== undefined) {
                this.removeCronJob(id);
                if (updated.enabled) {
                    this.reRegisterCronJob(id, dto.cron);
                }
            }

            const scraper =
                this.scraperRegistry.findByBankId(updated.bankId) ??
                this.unknownScraperFallback(updated.bankId);
            return SyncScheduleResponseDto.fromEntity(updated, scraper);
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new NotFoundException(`Sync schedule with ID ${id} not found`);
            }
            this.logger.error('Failed to update sync schedule', err instanceof Error ? err.stack : undefined);
            throw err;
        }
    }

    /** Remove a sync schedule and its cron job. */
    public async remove(userId: string, id: string): Promise<void> {
        const existing = await this.prisma.syncSchedule.findFirst({where: {id, userId}});
        if (!existing) {
            throw new NotFoundException(`Sync schedule with ID ${id} not found`);
        }

        this.removeCronJob(id);

        try {
            // Delete child SyncJob records first to avoid FK constraint violation.
            // (SyncJob.syncSchedule relation has no onDelete: Cascade in schema)
            // Both operations are inside the try/catch so a deleteMany failure is
            // caught and logged rather than leaving the scheduler and DB out of sync.
            await this.prisma.syncJob.deleteMany({where: {syncScheduleId: id}});
            await this.prisma.syncSchedule.delete({where: {id}});
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
                throw new NotFoundException(`Sync schedule with ID ${id} not found`);
            }
            this.logger.error('Failed to delete sync schedule', err instanceof Error ? err.stack : undefined);
            throw err;
        }
    }

    // ---------------------------------------------------------------------------
    // Ownership guard (used by controller guards)
    // ---------------------------------------------------------------------------

    /** Throws ForbiddenException if the schedule does not belong to the user. */
    public async assertOwnership(userId: string, id: string): Promise<void> {
        const schedule = await this.prisma.syncSchedule.findFirst({where: {id}});
        if (!schedule) {
            throw new NotFoundException(`Sync schedule with ID ${id} not found`);
        }
        if (schedule.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    /**
     * Atomically ensure a cron job is registered in SchedulerRegistry.
     *
     * Removes any stale entry under the same key before adding the new one,
     * so callers (including ScraperScheduler on startup) never need to manage
     * the delete-then-add pair themselves.
     *
     * Public so that ScraperScheduler can re-register jobs on startup without
     * duplicating CronJob construction logic.
     */
    public reRegisterCronJob(scheduleId: string, cron: string): void {
        const name = `sync-${scheduleId}`;
        // Remove any stale registration from a previous process run or hot reload.
        // SchedulerRegistry throws when the name is absent — expected on first boot.
        try {
            this.schedulerRegistry.deleteCronJob(name);
        } catch {
            // No stale job present — first registration for this schedule
        }
        /* v8 ignore next 5 */
        const job = new CronJob(cron, () => {
            this.logger.log(`[cron] sync schedule ${scheduleId} triggered`);
            // ScraperService.sync() will be called here in Step 5
        });
        this.schedulerRegistry.addCronJob(name, job);
        job.start();
    }

    private removeCronJob(scheduleId: string): void {
        const name = `sync-${scheduleId}`;
        try {
            this.schedulerRegistry.deleteCronJob(name);
        } catch {
            // Cron job may not exist if we're deleting a disabled schedule
        }
    }

    /** Fallback scraper metadata when the registered plugin is no longer available. */
    private unknownScraperFallback(bankId: string): {
        bankId: string;
        displayName: string;
        requiresMfaOnEveryRun: boolean;
        maxLookbackDays: number;
        pendingTransactionsIncluded: boolean;
        login: () => Promise<void>;
        scrapeTransactions: () => Promise<never[]>;
    } {
        return {
            bankId,
            displayName: `Unknown (${bankId})`,
            requiresMfaOnEveryRun: false,
            maxLookbackDays: 90,
            pendingTransactionsIncluded: false,
            login: (): Promise<void> => Promise.resolve(),
            scrapeTransactions: (): Promise<never[]> => Promise.resolve([])
        };
    }
}
