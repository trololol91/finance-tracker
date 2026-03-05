import {
    describe,
    it,
    expect,
    beforeEach
} from 'vitest';
import type {ExecutionContext} from '@nestjs/common';
import {ForbiddenException} from '@nestjs/common';
import {AdminGuard} from '#common/guards/admin.guard.js';
import type {User} from '#generated/prisma/client.js';

describe('AdminGuard', () => {
    let guard: AdminGuard;

    const baseUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: false,
        isActive: true,
        deletedAt: null,
        timezone: 'UTC',
        currency: 'USD',
        role: 'USER',
        notifyPush: true,
        notifyEmail: true,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const makeCtx = (user: User): ExecutionContext =>
        ({
            switchToHttp: () => ({
                getRequest: () => ({user})
            })
        }) as ExecutionContext;

    beforeEach(() => {
        guard = new AdminGuard();
    });

    describe('canActivate', () => {
        it('should allow access when user has ADMIN role', () => {
            const adminUser: User = {...baseUser, id: 'admin-1', role: 'ADMIN'};

            const result = guard.canActivate(makeCtx(adminUser));

            expect(result).toBe(true);
        });

        it('should throw ForbiddenException when user has USER role', () => {
            expect(() => guard.canActivate(makeCtx(baseUser))).toThrow(ForbiddenException);
            expect(() => guard.canActivate(makeCtx(baseUser))).toThrow('Admin access required');
        });
    });
});
