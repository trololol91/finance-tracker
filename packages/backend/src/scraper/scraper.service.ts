import {
    Injectable,
    NotFoundException,
    Logger
} from '@nestjs/common';
import {Worker} from 'worker_threads';
import {join} from 'path';
import {fileURLToPath} from 'url';
import type {MessageEvent} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import {PushService} from '#push/push.service.js';
import {CryptoService} from '#scraper/crypto/crypto.service.js';
import {SyncSessionStore} from '#scraper/sync-session.store.js';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import {
    SyncJobStatus, SyncRunStatus
} from '#scraper/sync-job-status.js';
import type {SyncSchedule} from '#generated/prisma/client.js';
import type {
    ScraperWorkerInput,
    WorkerMessage,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';
import {CategoriesService} from '#categories/categories.service.js';
import {AiCategorizationService} from '#ai-categorization/ai-categorization.service.js';
import {CategoryRulesService} from '#category-rules/category-rules.service.js';

/** Type guard for messages received from the scraper worker thread. */
const isWorkerMessage = (msg: unknown): msg is WorkerMessage =>
    typeof msg === 'object' && msg !== null && 'type' in msg;

/** Result of a completed sync run. */
export interface SyncResult {
    importedCount: number;
    skippedCount: number;
}

/**
 * Orchestrates scraper worker threads for on-demand and scheduled syncs.
 * Each call to `sync()` creates a SyncJob record, spawns a worker thread,
 * and streams status updates through SyncSessionStore (SSE).
 */
@Injectable()
export class ScraperService {
    private readonly logger = new Logger(ScraperService.name);
    /** Default timeout per sync run: 5 minutes. */
    private static readonly WORKER_TIMEOUT_MS = 5 * 60 * 1000;

    // eslint-disable-next-line max-params
    constructor(
        private readonly prisma: PrismaService,
        private readonly cryptoService: CryptoService,
        private readonly sessionStore: SyncSessionStore,
        private readonly pushService: PushService,
        private readonly registry: ScraperRegistry,
        private readonly categoriesService: CategoriesService,
        private readonly aiCategorizationService: AiCategorizationService,
        private readonly categoryRulesService: CategoryRulesService
    ) {}

    /**
     * Start an async sync job for the given schedule.
     * Returns `{ sessionId }` immediately; the worker runs in background.
     * The `sessionId` is the SyncJob ID — subscribe to
     * `GET /sync-schedules/:id/stream` with this ID for live status.
     */
    public async sync(
        userId: string,
        scheduleId: string,
        triggeredBy: 'cron' | 'manual' = 'manual',
        startDateOverride?: string,
        dryRun = false
    ): Promise<{sessionId: string}> {
        const schedule = await this.prisma.syncSchedule.findFirst({
            where: {id: scheduleId, userId}
        });
        if (!schedule) {
            throw new NotFoundException(
                `Sync schedule with ID ${scheduleId} not found`
            );
        }

        const job = await this.prisma.syncJob.create({
            data: {
                userId,
                syncScheduleId: scheduleId,
                triggeredBy,
                status: SyncJobStatus.pending
            }
        });

        const sessionId = job.id;
        this.sessionStore.createSession(sessionId);
        this.sessionStore.emit(sessionId, {
            data: JSON.stringify({status: SyncJobStatus.pending, message: 'Sync job queued'})
        } as MessageEvent);

        // Spawn worker asynchronously — do not block the caller
        void this.runWorker(sessionId, job.id, schedule, startDateOverride, dryRun);

        return {sessionId};
    }

    // ---------------------------------------------------------------------------
    // Private — worker lifecycle
    // ---------------------------------------------------------------------------

    private async runWorker(
        sessionId: string,
        jobId: string,
        schedule: SyncSchedule,
        startDateOverride?: string,
        dryRun = false
    ): Promise<void> {
        try {
            await this.prisma.syncJob.update({
                where: {id: jobId},
                data: {status: SyncJobStatus.loggingIn}
            });
            this.sessionStore.emit(sessionId, {
                data: JSON.stringify({
                    status: SyncJobStatus.loggingIn,
                    message: `Connecting to ${schedule.bankId}...`
                })
            } as MessageEvent);

            const inputs = JSON.parse(
                this.cryptoService.decrypt(schedule.pluginConfigEnc)
            ) as Record<string, string>;

            const pluginPath = this.registry.getPluginPath(schedule.bankId);
            if (!pluginPath) {
                throw new NotFoundException(
                    `No plugin registered for bankId '${schedule.bankId}'`
                );
            }

            const startDate = startDateOverride
                ? new Date(startDateOverride)
                : this.computeStartDate(schedule);
            const endDate = new Date();

            const workerInput: ScraperWorkerInput = {
                bankId: schedule.bankId,
                inputs,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                accountId: schedule.accountId,
                jobId,
                userId: schedule.userId,
                dryRun,
                pluginPath,
                databaseUrl: process.env.DATABASE_URL ?? ''
            };

            /* v8 ignore next 3 */
            const workerPath = join(
                fileURLToPath(new URL('.', import.meta.url)), 'scraper.worker.js'
            );
            /* v8 ignore next 5 */
            const worker = new Worker(workerPath, {workerData: workerInput});
            const timeout = setTimeout(() => {
                void worker.terminate();
            }, ScraperService.WORKER_TIMEOUT_MS);

            worker.on('message', (msg: unknown) => {
                if (!isWorkerMessage(msg)) return;
                void this.handleWorkerMessage(sessionId, jobId, schedule, msg, worker);
            });

            worker.on('error', (err: Error) => {
                clearTimeout(timeout);
                void this.handleWorkerError(sessionId, jobId, schedule, err);
            });

            /* v8 ignore next 5 */
            worker.on('exit', (code: number | null) => {
                clearTimeout(timeout);
                if (code !== 0 && code !== null) {
                    this.logger.warn(
                        `Scraper worker exited with code ${String(code)} for job ${jobId}`
                    );
                }
            });
        } catch (err) {
            await this.handleWorkerError(sessionId, jobId, schedule, err as Error);
        }
    }

    private async handleWorkerMessage(
        sessionId: string,
        jobId: string,
        schedule: SyncSchedule,
        msg: WorkerMessage,
        worker: Worker
    ): Promise<void> {
        if (msg.type === 'status') {
            this.sessionStore.emit(sessionId, {
                data: JSON.stringify({status: msg.status, message: msg.message})
            } as MessageEvent);
        } else if (msg.type === 'mfa_required') {
            await this.handleMfaRequired(sessionId, jobId, msg.prompt, worker, schedule.userId);
        } else {
            await this.handleResult(
                sessionId, jobId, schedule, msg
            );
        }
    }

    private async handleMfaRequired(
        sessionId: string,
        jobId: string,
        prompt: string,
        worker: Worker,
        userId: string
    ): Promise<void> {
        await this.prisma.syncJob.update({
            where: {id: jobId},
            data: {status: SyncJobStatus.mfaRequired, mfaChallenge: prompt}
        });

        this.sessionStore.emit(sessionId, {
            data: JSON.stringify({status: SyncJobStatus.mfaRequired, mfaChallenge: prompt})
        } as MessageEvent);

        void this.pushService.sendNotification(
            userId,
            'MFA Required',
            prompt,
            `/sync?jobId=${jobId}`
        );

        // Register resolver: when user submits code, post it back to the worker.
        // The worker is suspended on `parentPort.once('message')`.
        // Guard against the case where the timeout fires and terminates the worker
        // before the user submits the MFA code — postMessage on a dead worker throws.
        this.sessionStore.setMfaResolver(sessionId, (code: string) => {
            try {
                worker.postMessage({type: 'mfa_code', code});
            } catch (postErr: unknown) {
                this.logger.warn(
                    `MFA code submitted for terminated worker (job ${jobId}) — ignoring: ` +
                    (postErr instanceof Error ? postErr.message : String(postErr))
                );
            }
        });
    }

    private async handleResult(
        sessionId: string,
        jobId: string,
        schedule: SyncSchedule,
        result: {transactions: RawTransaction[], importedCount: number, skippedCount: number}
    ): Promise<void> {
        const {importedCount, skippedCount} = result;
        const now = new Date();

        await this.prisma.syncJob.update({
            where: {id: jobId},
            data: {
                status: SyncJobStatus.complete,
                importedCount,
                skippedCount
            }
        });

        await this.prisma.syncSchedule.update({
            where: {id: schedule.id},
            data: {
                lastRunAt: now,
                lastRunStatus: SyncRunStatus.success,
                lastSuccessfulSyncAt: now
            }
        });

        this.sessionStore.emit(sessionId, {
            data: JSON.stringify({status: SyncJobStatus.complete, importedCount, skippedCount})
        } as MessageEvent);

        this.sessionStore.complete(sessionId);

        if (schedule.autoCategorizeLlm && importedCount > 0) {
            const job = await this.prisma.syncJob.findUnique({where: {id: jobId}});
            let since: Date;
            if (job?.startedAt) {
                since = job.startedAt;
            } else {
                since = job?.createdAt ?? now;
                this.logger.warn(
                    `job.startedAt is null for job ${jobId} — falling back to createdAt for auto-categorize window`
                );
            }
            await this.autoCategorizeSyncedTransactions(
                schedule.userId,
                schedule.accountId,
                since
            );
        }
    }

    private async handleWorkerError(
        sessionId: string,
        jobId: string,
        schedule: SyncSchedule,
        err: Error
    ): Promise<void> {
        this.logger.error(
            `Scraper worker failed for job ${jobId}`,
            err.stack
        );

        const now = new Date();

        await this.prisma.syncJob.update({
            where: {id: jobId},
            data: {status: SyncJobStatus.failed, errorMessage: err.message}
        });

        await this.prisma.syncSchedule.update({
            where: {id: schedule.id},
            data: {lastRunAt: now, lastRunStatus: SyncRunStatus.failed}
        });

        this.sessionStore.emit(sessionId, {
            data: JSON.stringify({status: SyncJobStatus.failed, errorMessage: err.message})
        } as MessageEvent);

        this.sessionStore.complete(sessionId);
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Auto-categorize transactions imported during a sync run.
     * Queries uncategorized active transactions created since `since`
     * for the given user+account and applies AI suggestions.
     *
     * Uses createdAt >= job.startedAt (fallback: job.createdAt) as a proxy for
     * 'imported during this sync'. Clock skew or a long-running worker may cause
     * some transactions to be missed.
     */
    private async autoCategorizeSyncedTransactions(
        userId: string,
        accountId: string,
        since: Date
    ): Promise<void> {
        const categories = await this.categoriesService.findAll(userId);
        const active = categories.filter(c => c.isActive);

        if (active.length === 0) {
            this.logger.warn(`No active categories for user ${userId} — skipping auto-categorization`);
            return;
        }

        const categoryNames = active.map(c => c.name);
        const otherCat = active.find(c => c.name === 'Other') ?? active[0];

        // cap matches bulkCategorize endpoint to prevent unbounded AI calls
        const transactions = await this.prisma.transaction.findMany({
            where: {userId, accountId, categoryId: null, isActive: true, createdAt: {gte: since}},
            take: 200
        });

        const matchRule = await this.categoryRulesService.buildMatcher(userId);

        const needsAi: typeof transactions = [];
        const updates: {id: string, categoryId: string}[] = [];

        for (const tx of transactions) {
            const ruleMatch = matchRule(tx.description);
            if (ruleMatch !== null) {
                updates.push({id: tx.id, categoryId: ruleMatch});
            } else {
                needsAi.push(tx);
            }
        }

        const suggestionMap = await this.aiCategorizationService.suggestCategories(
            needsAi.map(tx => ({
                id: tx.id,
                description: tx.description,
                transactionType: tx.transactionType
            })),
            categoryNames
        );

        for (const tx of needsAi) {
            const suggestedName = suggestionMap.get(tx.id) ?? null;
            if (suggestedName === null) {
                this.logger.warn(
                    `Failed to auto-categorize transaction ${tx.id} — AI returned null`
                );
                continue;
            }
            const match =
                active.find(c => c.name.toLowerCase() === suggestedName.toLowerCase()) ??
                otherCat;
            updates.push({id: tx.id, categoryId: match.id});
        }

        if (updates.length > 0) {
            await this.prisma.$transaction(
                updates.map(u =>
                    this.prisma.transaction.update({
                        where: {id: u.id},
                        data: {categoryId: u.categoryId}
                    })
                )
            );
        }

        this.logger.log(
            `Auto-categorized ${updates.length} of ${transactions.length} synced transactions for account ${accountId}`
        );
    }

    /**
     * Compute the start date for the sync window.
     * Uses lastSuccessfulSyncAt minus lookbackDays (overlap window),
     * falling back to 30 days ago for first-ever sync.
     */
    private computeStartDate(schedule: SyncSchedule): Date {
        if (schedule.lastSuccessfulSyncAt) {
            const ms =
                schedule.lastSuccessfulSyncAt.getTime() -
                schedule.lookbackDays * 24 * 60 * 60 * 1000;
            return new Date(ms);
        }
        // First sync: default 30-day lookback
        return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
}
