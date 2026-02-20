import {
    describe,
    it,
    expect,
    beforeEach
} from 'vitest';
import type {ExecutionContext} from '@nestjs/common';
import {ForbiddenException} from '@nestjs/common';
import {OwnershipGuard} from '#common/guards/ownership.guard.js';
import type {User} from '#generated/prisma/client.js';

describe('OwnershipGuard', () => {
    let guard: OwnershipGuard;

    const mockUser: User = {
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
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        guard = new OwnershipGuard();
    });

    describe('canActivate', () => {
        it('should allow access when user ID matches resource ID', () => {
            const mockExecutionContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        user: mockUser,
                        params: {id: 'user-123'}
                    })
                })
            } as ExecutionContext;

            const result = guard.canActivate(mockExecutionContext);

            expect(result).toBe(true);
        });

        it('should deny access when user ID does not match resource ID', () => {
            const mockExecutionContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        user: mockUser,
                        params: {id: 'user-456'}
                    })
                })
            } as ExecutionContext;

            expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(mockExecutionContext)).toThrow(
                'You do not have permission to access this resource'
            );
        });

        it('should allow admin users to access any resource', () => {
            const adminUser: User = {
                ...mockUser,
                id: 'admin-123',
                role: 'ADMIN'
            };

            const mockExecutionContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        user: adminUser,
                        params: {id: 'user-456'}
                    })
                })
            } as ExecutionContext;

            const result = guard.canActivate(mockExecutionContext);

            expect(result).toBe(true);
        });

        it('should allow admin to access their own resource', () => {
            const adminUser: User = {
                ...mockUser,
                id: 'admin-123',
                role: 'ADMIN'
            };

            const mockExecutionContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        user: adminUser,
                        params: {id: 'admin-123'}
                    })
                })
            } as ExecutionContext;

            const result = guard.canActivate(mockExecutionContext);

            expect(result).toBe(true);
        });

        it('should handle UUID format resource IDs', () => {
            const userWithUUID: User = {
                ...mockUser,
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            const mockExecutionContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        user: userWithUUID,
                        params: {id: '550e8400-e29b-41d4-a716-446655440000'}
                    })
                })
            } as ExecutionContext;

            const result = guard.canActivate(mockExecutionContext);

            expect(result).toBe(true);
        });

        it('should deny access with case-sensitive ID comparison', () => {
            const mockExecutionContext = {
                switchToHttp: () => ({
                    getRequest: () => ({
                        user: mockUser,
                        params: {id: 'USER-123'}
                    })
                })
            } as ExecutionContext;

            expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
        });
    });

    describe('guard behavior', () => {
        it('should be defined', () => {
            expect(guard).toBeDefined();
        });

        it('should have canActivate method', () => {
            expect(guard.canActivate).toBeDefined();
            expect(typeof guard.canActivate).toBe('function');
        });
    });
});
