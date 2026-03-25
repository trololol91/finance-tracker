import {
    Injectable,
    Logger,
    OnModuleInit
} from '@nestjs/common';
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
 * CronJob construction and the stale-deletion guard are both delegated to
 * SyncScheduleService.reRegisterCronJob, which owns the atomic delete-then-add
 * logic. ScraperScheduler therefore has no direct SchedulerRegistry dependency.
 */
@Injectable()
export class ScraperScheduler implements OnModuleInit {
    private readonly logger = new Logger(ScraperScheduler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly syncScheduleService: SyncScheduleService
    ) {}

    public async onModuleInit(): Promise<void> {
        const schedules = await this.prisma.syncSchedule.findMany({
            where: {enabled: true},
            select: {id: true, userId: true, cron: true}
        });

        if (schedules.length === 0) {
            this.logger.log('No enabled sync schedules to restore on startup');
            return;
        }

        for (const schedule of schedules) {
            this.syncScheduleService.reRegisterCronJob(schedule.id, schedule.userId, schedule.cron);
            this.logger.log(
                `Registered cron job 'sync-${schedule.id}' with expression '${schedule.cron}'`
            );
        }

        this.logger.log(
            `Restored ${schedules.length} enabled sync schedule cron job(s) on startup`
        );
    }
}
