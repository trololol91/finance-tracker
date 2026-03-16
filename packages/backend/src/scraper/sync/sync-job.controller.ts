import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
    UseGuards,
    BadRequestException,
    NotFoundException,
    Sse
} from '@nestjs/common';
import type {MessageEvent} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBearerAuth
} from '@nestjs/swagger';
import {
    Observable, of
} from 'rxjs';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {
    User,
    SyncJob
} from '#generated/prisma/client.js';
import {PrismaService} from '#database/prisma.service.js';
import {ScraperService} from '#scraper/scraper.service.js';
import {SyncSessionStore} from '#scraper/sync-session.store.js';
import {SyncJobStatus} from '#scraper/sync-job-status.js';
import {RunSyncNowDto} from '#scraper/sync/dto/run-sync-now.dto.js';
import {MfaResponseDto} from '#scraper/sync/dto/mfa-response.dto.js';

@ApiTags('sync-schedules')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sync-schedules')
export class SyncJobController {
    constructor(
        private readonly scraperService: ScraperService,
        private readonly sessionStore: SyncSessionStore,
        private readonly prisma: PrismaService
    ) {}

    /**
     * Trigger an immediate sync for the given schedule.
     * POST /sync-schedules/:id/run-now
     * Returns { sessionId } immediately; the worker runs asynchronously.
     * Subscribe to GET /sync-schedules/:sessionId/stream for live status.
     */
    @Post(':id/run-now')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Trigger manual sync',
        description:
            'Start an immediate sync for the given schedule. Returns a sessionId to subscribe to the SSE stream.'
    })
    @ApiParam({name: 'id', description: 'Sync schedule UUID', type: String})
    @ApiResponse({status: 201, description: 'Sync started; returns sessionId'})
    @ApiResponse({status: 400, description: 'Invalid startDate'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Sync schedule not found'})
    public async runNow(
        @Param('id', new ParseUUIDPipe({version: '4'})) scheduleId: string,
        @Body() dto: RunSyncNowDto,
        @CurrentUser() currentUser: User
    ): Promise<{sessionId: string}> {
        return this.scraperService.sync(
            currentUser.id,
            scheduleId,
            'manual',
            dto.startDate,
            dto.dryRun ?? false
        );
    }

    /**
     * Subscribe to real-time SSE events for a running sync job.
     * GET /sync-schedules/:id/stream  — `:id` is the sessionId returned by run-now.
     * Emits a series of MessageEvent objects; auto-closes on `complete` or `failed`.
     */
    @Get(':id/stream')
    @Sse()
    @ApiOperation({
        summary: 'SSE stream for sync job',
        description:
            'Subscribe to real-time status events for a running sync job. ' +
            'The :id is the sessionId returned by POST /:scheduleId/run-now.'
    })
    @ApiParam({name: 'id', description: 'Session (SyncJob) UUID', type: String})
    @ApiResponse({status: 200, description: 'SSE stream (text/event-stream)'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({
        status: 404,
        description:
            'Session not found, not owned by user, or server restarted mid-sync ' +
            '(mfa_required / running state cannot be resumed — start a new sync run).'
    })
    public async stream(
        @Param('id', new ParseUUIDPipe({version: '4'})) sessionId: string,
        @CurrentUser() currentUser: User
    ): Promise<Observable<MessageEvent>> {
        const job = await this.assertJobOwner(sessionId, currentUser.id);

        if (!this.sessionStore.hasSession(sessionId)) {
            // Race condition: the worker completed (or failed) before the frontend
            // established the SSE connection (common with fast / stub scrapers).
            // Rather than returning 404, replay the terminal event from the
            // persisted job status so the frontend panel transitions correctly.
            //
            // Note: mfa_required / running / logging_in with no in-memory session
            // means the server restarted mid-sync. There is no way to resume an
            // MFA challenge without the worker thread, so 404 is intentional —
            // the client must start a new sync run.
            if (job.status === SyncJobStatus.complete) {
                return of({
                    data: JSON.stringify({
                        status: SyncJobStatus.complete,
                        importedCount: job.importedCount,
                        skippedCount: job.skippedCount
                    })
                } as MessageEvent);
            }
            if (job.status === SyncJobStatus.failed) {
                return of({
                    data: JSON.stringify({
                        status: SyncJobStatus.failed,
                        errorMessage: job.errorMessage ?? 'Sync failed'
                    })
                } as MessageEvent);
            }
            throw new NotFoundException(
                `Sync session ${sessionId} is not active`
            );
        }

        return this.sessionStore.getObservable(sessionId);
    }

    /**
     * Submit an MFA code to a paused sync worker.
     * POST /sync-schedules/:id/mfa-response  — `:id` is the sessionId.
     * Returns 400 if no MFA challenge is pending for this session.
     */
    @Post(':id/mfa-response')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Submit MFA code',
        description:
            'Submit the MFA code to a sync worker waiting for user input. ' +
            'Returns 400 if no MFA challenge is pending.'
    })
    @ApiParam({name: 'id', description: 'Session (SyncJob) UUID', type: String})
    @ApiResponse({status: 200, description: 'MFA code accepted'})
    @ApiResponse({status: 400, description: 'No pending MFA challenge for this session'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Session not found or not owned by user'})
    public async mfaResponse(
        @Param('id', new ParseUUIDPipe({version: '4'})) sessionId: string,
        @Body() dto: MfaResponseDto,
        @CurrentUser() currentUser: User
    ): Promise<{ok: true}> {
        await this.assertJobOwner(sessionId, currentUser.id);

        if (!this.sessionStore.hasPendingMfa(sessionId)) {
            throw new BadRequestException(
                `No pending MFA challenge for session ${sessionId}`
            );
        }

        this.sessionStore.resolveMfa(sessionId, dto.code);
        return {ok: true};
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Look up a SyncJob by id and verify it belongs to the requesting user.
     * Throws NotFoundException for both missing jobs and ownership mismatches
     * to avoid leaking whether a session exists for another user.
     */
    private async assertJobOwner(
        sessionId: string,
        userId: string
    ): Promise<SyncJob> {
        const job = await this.prisma.syncJob.findUnique({where: {id: sessionId}});
        if (!job || job.userId !== userId) {
            throw new NotFoundException(`Sync session ${sessionId} not found`);
        }
        return job;
    }
}
