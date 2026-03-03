import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
    UseGuards
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBearerAuth
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';
import {SyncScheduleService} from '#scraper/sync/sync-schedule.service.js';
import {SyncScheduleResponseDto} from '#scraper/sync/dto/sync-schedule-response.dto.js';
import {CreateSyncScheduleDto} from '#scraper/sync/dto/create-sync-schedule.dto.js';
import {UpdateSyncScheduleDto} from '#scraper/sync/dto/update-sync-schedule.dto.js';

@ApiTags('sync-schedules')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sync-schedules')
export class SyncScheduleController {
    constructor(private readonly syncScheduleService: SyncScheduleService) {}

    /**
     * List all sync schedules for the authenticated user.
     * GET /sync-schedules
     */
    @Get()
    @ApiOperation({summary: 'List sync schedules', description: 'Get all sync schedules for the authenticated user'})
    @ApiResponse({status: 200, description: 'List of sync schedules', type: [SyncScheduleResponseDto]})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findAll(@CurrentUser() currentUser: User): Promise<SyncScheduleResponseDto[]> {
        return this.syncScheduleService.findAll(currentUser.id);
    }

    /**
     * Get a single sync schedule by ID.
     * GET /sync-schedules/:id
     */
    @Get(':id')
    @ApiOperation({summary: 'Get sync schedule by ID'})
    @ApiParam({name: 'id', description: 'Sync schedule UUID', type: String})
    @ApiResponse({status: 200, description: 'Sync schedule found', type: SyncScheduleResponseDto})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Sync schedule not found'})
    public async findOne(
        @Param('id', new ParseUUIDPipe({version: '4'})) id: string,
        @CurrentUser() currentUser: User
    ): Promise<SyncScheduleResponseDto> {
        return this.syncScheduleService.findOne(currentUser.id, id);
    }

    /**
     * Create a new sync schedule.
     * POST /sync-schedules
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create sync schedule',
        description: 'Create a new automated sync schedule for a bank account. Credentials are encrypted at rest.'
    })
    @ApiResponse({status: 201, description: 'Sync schedule created', type: SyncScheduleResponseDto})
    @ApiResponse({status: 400, description: 'Invalid bankId, accountId, or cron expression'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Account not found'})
    @ApiResponse({status: 409, description: 'A sync schedule for this account already exists'})
    public async create(
        @Body() dto: CreateSyncScheduleDto,
        @CurrentUser() currentUser: User
    ): Promise<SyncScheduleResponseDto> {
        return this.syncScheduleService.create(currentUser.id, dto);
    }

    /**
     * Update an existing sync schedule.
     * PATCH /sync-schedules/:id
     */
    @Patch(':id')
    @ApiOperation({
        summary: 'Update sync schedule',
        description: 'Update cron, credentials, or enabled state. Re-encrypts credentials if password provided.'
    })
    @ApiParam({name: 'id', description: 'Sync schedule UUID', type: String})
    @ApiResponse({status: 200, description: 'Sync schedule updated', type: SyncScheduleResponseDto})
    @ApiResponse({status: 400, description: 'Invalid cron expression'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Sync schedule not found'})
    public async update(
        @Param('id', new ParseUUIDPipe({version: '4'})) id: string,
        @Body() dto: UpdateSyncScheduleDto,
        @CurrentUser() currentUser: User
    ): Promise<SyncScheduleResponseDto> {
        return this.syncScheduleService.update(currentUser.id, id, dto);
    }

    /**
     * Delete a sync schedule.
     * DELETE /sync-schedules/:id
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete sync schedule',
        description: 'Removes the cron job and hard-deletes the record. Does not affect synced transactions.'
    })
    @ApiParam({name: 'id', description: 'Sync schedule UUID', type: String})
    @ApiResponse({status: 204, description: 'Sync schedule deleted'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Sync schedule not found'})
    public async remove(
        @Param('id', new ParseUUIDPipe({version: '4'})) id: string,
        @CurrentUser() currentUser: User
    ): Promise<void> {
        return this.syncScheduleService.remove(currentUser.id, id);
    }
}
