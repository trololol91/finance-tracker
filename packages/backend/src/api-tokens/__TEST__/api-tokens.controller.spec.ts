import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {ApiTokensController} from '#api-tokens/api-tokens.controller.js';
import type {ApiTokensService} from '#api-tokens/api-tokens.service.js';
import type {CreateApiTokenDto} from '#api-tokens/dto/create-api-token.dto.js';
import type {User} from '#generated/prisma/client.js';

const mockService = {
    create: vi.fn(),
    findAll: vi.fn(),
    remove: vi.fn()
} as unknown as ApiTokensService;

const mockUser: User & {role: string} = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'USD',
    role: 'USER',
    notifyEmail: true,
    createdAt: new Date(),
    updatedAt: new Date()
};

describe('ApiTokensController', () => {
    let controller: ApiTokensController;

    beforeEach(() => {
        vi.clearAllMocks();
        controller = new ApiTokensController(mockService);
    });

    describe('create', () => {
        it('delegates to service.create with user id and role', async () => {
            const dto: CreateApiTokenDto = {name: 'My Token', scopes: ['transactions:read']};
            const expected = {id: 'tok-1', token: 'ft_abc', name: 'My Token', scopes: ['transactions:read']};
            vi.mocked(mockService.create).mockResolvedValue(expected as never);

            const result = await controller.create(dto, mockUser);

            expect(mockService.create).toHaveBeenCalledWith('user-1', 'USER', dto);
            expect(result).toBe(expected);
        });
    });

    describe('findAll', () => {
        it('delegates to service.findAll with user id', async () => {
            const tokens = [{id: 'tok-1', name: 'My Token', scopes: ['accounts:read'], createdAt: '2025-01-01'}];
            vi.mocked(mockService.findAll).mockResolvedValue(tokens as never);

            const result = await controller.findAll(mockUser);

            expect(mockService.findAll).toHaveBeenCalledWith('user-1');
            expect(result).toBe(tokens);
        });
    });

    describe('remove', () => {
        it('delegates to service.remove with user id and token id', async () => {
            vi.mocked(mockService.remove).mockResolvedValue(undefined);

            await controller.remove('tok-1', mockUser);

            expect(mockService.remove).toHaveBeenCalledWith('user-1', 'tok-1');
        });
    });
});
