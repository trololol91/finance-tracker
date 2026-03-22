import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import {SyncScheduleController} from '#scraper/sync/sync-schedule.controller.js';
import type {SyncScheduleService} from '#scraper/sync/sync-schedule.service.js';
import type {SyncScheduleResponseDto} from '#scraper/sync/dto/sync-schedule-response.dto.js';
import type {User} from '#generated/prisma/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed',
    firstName: 'Jane',
    lastName: 'Smith',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'USD',
    role: 'USER',
    notifyPush: true,
    notifyEmail: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

const mockScheduleResponse: SyncScheduleResponseDto = {
    id: 'sched-uuid-1',
    accountId: 'acct-uuid-1',
    bankId: 'cibc',
    displayName: 'CIBC',
    cron: '0 8 * * *',
    enabled: true,
    requiresMfaOnEveryRun: true,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    lookbackDays: 3,
    autoCategorizeLlm: false,
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessfulSyncAt: null,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncScheduleController', () => {
    let controller: SyncScheduleController;
    let service: SyncScheduleService;

    beforeEach(() => {
        service = {
            findAll: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        } as unknown as SyncScheduleService;

        controller = new SyncScheduleController(service);
        vi.clearAllMocks();
    });

    describe('findAll', () => {
        it('should return an array of sync schedules', async () => {
            vi.mocked(service.findAll).mockResolvedValue([mockScheduleResponse]);

            const result = await controller.findAll(mockUser);

            expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
            expect(result).toEqual([mockScheduleResponse]);
        });
    });

    describe('findOne', () => {
        it('should return a single sync schedule', async () => {
            vi.mocked(service.findOne).mockResolvedValue(mockScheduleResponse);

            const result = await controller.findOne('sched-uuid-1', mockUser);

            expect(service.findOne).toHaveBeenCalledWith(mockUser.id, 'sched-uuid-1');
            expect(result).toEqual(mockScheduleResponse);
        });

        it('should propagate NotFoundException from service', async () => {
            vi.mocked(service.findOne).mockRejectedValue(new NotFoundException('Not found'));

            await expect(controller.findOne('bad-id', mockUser)).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create a sync schedule and return 201', async () => {
            vi.mocked(service.create).mockResolvedValue(mockScheduleResponse);
            const dto = {
                accountId: 'acct-uuid-1',
                bankId: 'cibc',
                inputs: {username: 'user1', password: 'pass1'},
                cron: '0 8 * * *'
            };

            const result = await controller.create(dto, mockUser);

            expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
            expect(result).toEqual(mockScheduleResponse);
        });

        it('should propagate BadRequestException for unknown bankId', async () => {
            vi.mocked(service.create).mockRejectedValue(
                new BadRequestException('Unknown bankId')
            );

            await expect(
                controller.create({
                    accountId: 'acct-uuid-1',
                    bankId: 'unknown-bank',
                    inputs: {username: 'u', password: 'p'},
                    cron: '0 8 * * *'
                }, mockUser)
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('update', () => {
        it('should update a sync schedule', async () => {
            const updated = {...mockScheduleResponse, cron: '0 20 * * *'};
            vi.mocked(service.update).mockResolvedValue(updated);

            const result = await controller.update('sched-uuid-1', {cron: '0 20 * * *'}, mockUser);

            expect(service.update).toHaveBeenCalledWith(mockUser.id, 'sched-uuid-1', {cron: '0 20 * * *'});
            expect(result.cron).toBe('0 20 * * *');
        });
    });

    describe('remove', () => {
        it('should delete a sync schedule and return void', async () => {
            vi.mocked(service.remove).mockResolvedValue(undefined);

            await controller.remove('sched-uuid-1', mockUser);

            expect(service.remove).toHaveBeenCalledWith(mockUser.id, 'sched-uuid-1');
        });

        it('should propagate NotFoundException when schedule not found', async () => {
            vi.mocked(service.remove).mockRejectedValue(new NotFoundException('Not found'));

            await expect(controller.remove('bad-id', mockUser)).rejects.toThrow(NotFoundException);
        });
    });
});
