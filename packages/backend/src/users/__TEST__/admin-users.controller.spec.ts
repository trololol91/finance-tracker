import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {AdminUsersController} from '#users/admin-users.controller.js';
import type {UsersService} from '#users/users.service.js';
import type {AdminUserListItemDto} from '#users/dto/admin-user-list-item.dto.js';
import {UserRole} from '#generated/prisma/enums.js';
import type {User} from '#generated/prisma/client.js';

describe('AdminUsersController', () => {
    let controller: AdminUsersController;
    let usersService: UsersService;

    const mockAdminUserList: AdminUserListItemDto[] = [
        {
            id: 'user-001',
            email: 'alice@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
            role: UserRole.USER,
            isActive: true,
            createdAt: new Date('2024-01-01')
        },
        {
            id: 'user-002',
            email: 'bob@example.com',
            firstName: 'Bob',
            lastName: 'Jones',
            role: UserRole.ADMIN,
            isActive: true,
            createdAt: new Date('2024-02-01')
        }
    ];

    const mockUpdatedUser: AdminUserListItemDto = {
        id: 'user-001',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date('2024-01-01')
    };

    const mockCurrentUser: User = {
        id: 'admin-999',
        email: 'admin@example.com',
        passwordHash: '$2b$10$hashedpassword',
        firstName: 'Admin',
        lastName: 'User',
        emailVerified: true,
        isActive: true,
        deletedAt: null,
        timezone: 'UTC',
        currency: 'USD',
        role: UserRole.ADMIN,
        notifyPush: true,
        notifyEmail: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    };

    beforeEach(() => {
        usersService = {
            findAllForAdmin: vi.fn(),
            updateRole: vi.fn()
        } as unknown as UsersService;

        controller = new AdminUsersController(usersService);
        vi.clearAllMocks();
    });

    describe('findAll', () => {
        /**
         * ACT-01: GET /admin/users calls usersService.findAllForAdmin() and returns result
         */
        it('ACT-01: calls findAllForAdmin() and returns the list of users', async () => {
            vi.mocked(usersService.findAllForAdmin).mockResolvedValue(mockAdminUserList);

            const result = await controller.findAll();

            expect(usersService.findAllForAdmin).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAdminUserList);
            expect(result).toHaveLength(2);
        });
    });

    describe('updateRole', () => {
        /**
         * ACT-02: PATCH /admin/users/:id/role calls usersService.updateRole()
         * with requestingUserId, target id, and role
         */
        it('ACT-02: calls updateRole() with requestingUserId, targetId, and role', async () => {
            vi.mocked(usersService.updateRole).mockResolvedValue(mockUpdatedUser);

            const dto = {role: UserRole.ADMIN};
            const result = await controller.updateRole('user-001', dto, mockCurrentUser);

            expect(usersService.updateRole).toHaveBeenCalledTimes(1);
            expect(usersService.updateRole).toHaveBeenCalledWith(
                mockCurrentUser.id,
                'user-001',
                UserRole.ADMIN
            );
            expect(result).toEqual(mockUpdatedUser);
            expect(result.role).toBe('ADMIN');
        });

        /**
         * ACT-03: PATCH /admin/users/:id/role passes currentUser.id as requestingUserId
         * so the service self-change guard receives the correct value
         */
        it('ACT-03: passes currentUser.id as the requestingUserId to usersService.updateRole()', async () => {
            vi.mocked(usersService.updateRole).mockResolvedValue(mockUpdatedUser);

            const dto = {role: UserRole.USER};
            await controller.updateRole('user-001', dto, mockCurrentUser);

            const [requestingUserId] = vi.mocked(usersService.updateRole).mock.calls[0];
            expect(requestingUserId).toBe(mockCurrentUser.id);
        });
    });
});
