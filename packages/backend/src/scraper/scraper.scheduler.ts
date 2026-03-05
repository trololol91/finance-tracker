import {
    Injectable,
    Logger,
    OnModuleInit
} from '@nestjs/common';
import {SchedulerRegistry} from '@nestjs/schedule';
import {PrismaService} from '#database/prisma.service.js';
import {SyncScheduleService} from '#scraper/sync/sync-schedule.service.js';

/**
 * ScraperScheduler runs once on module initialization.
 *
 * On server startup the NestJS SchedulerRegistry is empty — all cron jobs
 * that were active in the previous process are silently dropped. This service
 * queries every SyncSchedule record with enabled=true and re-registers its
 * cron job so that schedules survive a server restart without user intervention.
 *
 * CronJob construction is delegated to SyncScheduleService.reRegisterCronJob to
 * avoid duplicating the job-creation logic in two places.
 */
@Injectable()
export class ScraperScheduler implements OnModuleInit {
    private readonly logger = new Logger(ScraperScheduler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly syncScheduleService: SyncScheduleService
    ) {}

    public async onModuleInit(): Promise<void> {
        const schedules = await this.prisma.syncSchedule.findMany({
            where: {enabled: true},
            select: {id: true, cron: true}
        });

        if (schedules.length === 0) {
            this.logger.log('No enabled sync schedules to restore on startup');
            return;
        }

        for (const schedule of schedules) {
            this.registerCronJob(schedule.id, schedule.cron);
        }

        this.logger.log(
            `Restored ${schedules.length} enabled sync schedule cron job(s) on startup`
        );
    }

    private registerCronJob(scheduleId: string, cron: string): void {
        const name = `sync-${scheduleId}`;

        // Remove any stale registration from a previous module init (e.g. hot reload).
        // SchedulerRegistry.deleteCronJob throws when the name is not registered.
        try {
            this.schedulerRegistry.deleteCronJob(name);
        } catch {
            // Expected on first startup — no job registered yet
        }

        // Delegate CronJob construction to SyncScheduleService to avoid duplication.
        this.syncScheduleService.reRegisterCronJob(scheduleId, cron);
        this.logger.log(`Registered cron job '${name}' with expression '${cron}'`);
    }
}
