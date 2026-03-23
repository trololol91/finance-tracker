import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    NotFoundException, ConflictException, HttpStatus
} from '@nestjs/common';
import {AccountsController} from '#accounts/accounts.controller.js';
import type {AccountsService} from '#accounts/accounts.service.js';
import {AccountResponseDto} from '#accounts/dto/account-response.dto.js';
import {AccountType} from '#generated/prisma/client.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateAccountDto} from '#accounts/dto/create-account.dto.js';
import type {UpdateAccountDto} from '#accounts/dto/update-account.dto.js';
import type {Response} from 'express';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeDto = (overrides: Partial<AccountResponseDto> = {}): AccountResponseDto => {
    const dto = new AccountResponseDto();
    dto.id = 'acc-uuid-1';
    dto.userId = 'user-uuid-1';
    dto.name = 'Chequing';
    dto.type = AccountType.checking;
    dto.institution = 'TD Bank';
    dto.currency = 'CAD';
    dto.openingBalance = 1000;
    dto.currentBalance = 1250;
    dto.transactionCount = 5;
    dto.color = '#4CAF50';
    dto.notes = null;
    dto.isActive = true;
    dto.createdAt = new Date('2026-01-15T10:00:00.000Z');
    dto.updatedAt = new Date('2026-01-15T10:00:00.000Z');
    return Object.assign(dto, overrides);
};

const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashed',
    firstName: 'Jane',
    lastName: 'Smith',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'CAD',
    role: 'USER',
    notifyEmail: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

/** Creates a minimal mock Express Response for passthrough tests */
const mockRes = (): {status: ReturnType<typeof vi.fn>} => ({
    status: vi.fn()
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountsController', () => {
    let controller: AccountsController;
    let service: AccountsService;

    beforeEach(() => {
        service = {
            findAll: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        } as unknown as AccountsService;

        controller = new AccountsController(service);
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // GET /accounts
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('returns array from service.findAll', async () => {
            const dtos = [makeDto(), makeDto({id: 'acc-2', name: 'Savings'})];
            vi.mocked(service.findAll).mockResolvedValue(dtos);

            const result = await controller.findAll(mockUser);

            expect(result).toBe(dtos);
            expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
        });

        it('returns empty array when user has no accounts', async () => {
            vi.mocked(service.findAll).mockResolvedValue([]);

            const result = await controller.findAll(mockUser);

            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // GET /accounts/:id
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('returns dto for valid id', async () => {
            const dto = makeDto();
            vi.mocked(service.findOne).mockResolvedValue(dto);

            const result = await controller.findOne('acc-uuid-1', mockUser);

            expect(result).toBe(dto);
            expect(service.findOne).toHaveBeenCalledWith(mockUser.id, 'acc-uuid-1');
        });

        it('propagates NotFoundException from service', async () => {
            vi.mocked(service.findOne).mockRejectedValue(new NotFoundException('Account not found'));

            await expect(controller.findOne('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // POST /accounts
    // -------------------------------------------------------------------------

    describe('create', () => {
        const createDto: CreateAccountDto = {
            name: 'New Account',
            type: AccountType.savings
        };

        it('returns created dto', async () => {
            const dto = makeDto({name: 'New Account'});
            vi.mocked(service.create).mockResolvedValue(dto);

            const result = await controller.create(createDto, mockUser);

            expect(result).toBe(dto);
            expect(service.create).toHaveBeenCalledWith(mockUser.id, createDto);
        });

        it('propagates ConflictException from service', async () => {
            vi.mocked(service.create).mockRejectedValue(
                new ConflictException('An account with this name already exists')
            );

            await expect(controller.create(createDto, mockUser)).rejects.toThrow(ConflictException);
        });
    });

    // -------------------------------------------------------------------------
    // PATCH /accounts/:id
    // -------------------------------------------------------------------------

    describe('update', () => {
        const updateDto: UpdateAccountDto = {currency: 'USD'};

        it('returns updated dto', async () => {
            const dto = makeDto({currency: 'USD'});
            vi.mocked(service.update).mockResolvedValue(dto);

            const result = await controller.update('acc-uuid-1', updateDto, mockUser);

            expect(result).toBe(dto);
            expect(service.update).toHaveBeenCalledWith(mockUser.id, 'acc-uuid-1', updateDto);
        });

        it('propagates NotFoundException from service', async () => {
            vi.mocked(service.update).mockRejectedValue(new NotFoundException());

            // ParseUUIDPipe runs before the service in real HTTP flow; in unit tests
            // we bypass the pipe and test the service error path directly.
            await expect(
                controller.update('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', updateDto, mockUser)
            ).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // DELETE /accounts/:id
    // -------------------------------------------------------------------------

    describe('remove', () => {
        it('returns 204 and no body on hard-delete (service returns null)', async () => {
            vi.mocked(service.remove).mockResolvedValue(null);
            const res = mockRes();

            const result = await controller.remove('acc-uuid-1', mockUser, res as unknown as Response);

            expect(res.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
            expect(result).toBeUndefined();
        });

        it('returns 200 with dto on soft-delete (service returns dto)', async () => {
            const dto = makeDto({isActive: false});
            vi.mocked(service.remove).mockResolvedValue(dto);
            const res = mockRes();

            const result = await controller.remove('acc-uuid-1', mockUser, res as unknown as Response);

            expect(res.status).not.toHaveBeenCalled();
            expect(result).toBe(dto);
        });

        it('propagates NotFoundException when account does not exist', async () => {
            vi.mocked(service.remove).mockRejectedValue(new NotFoundException());
            const res = mockRes();

            // ParseUUIDPipe runs before the service in real HTTP flow; in unit tests
            // we bypass the pipe and test the service error path directly.
            await expect(
                controller.remove('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', mockUser, res as unknown as Response)
            ).rejects.toThrow(NotFoundException);
        });
    });
});
