import type {
    User, UserRole
} from '#generated/prisma/client.js';
import {ApiProperty} from '@nestjs/swagger';

export class UserResponseDto {
    @ApiProperty({description: 'User unique identifier (UUID)', example: '550e8400-e29b-41d4-a716-446655440000'})
    id!: string;

    @ApiProperty({description: 'User email address', example: 'user@example.com'})
    email!: string;

    @ApiProperty({description: 'User first name', example: 'John', nullable: true, required: false, type: String})
    firstName?: string | null;

    @ApiProperty({description: 'User last name', example: 'Doe', nullable: true, required: false, type: String})
    lastName?: string | null;

    @ApiProperty({description: 'Email verification status', example: false})
    emailVerified!: boolean;

    @ApiProperty({description: 'User account active status', example: true})
    isActive!: boolean;

    @ApiProperty({description: 'User timezone', example: 'UTC'})
    timezone!: string;

    @ApiProperty({description: 'User preferred currency', example: 'USD'})
    currency!: string;

    @ApiProperty({description: 'User role', enum: ['USER', 'ADMIN'], example: 'USER'})
    role!: UserRole;

    @ApiProperty({description: 'Account creation timestamp', example: '2026-02-16T12:00:00.000Z'})
    createdAt!: Date;

    @ApiProperty({description: 'Last update timestamp', example: '2026-02-16T12:00:00.000Z'})
    updatedAt!: Date;

    static fromEntity(user: User): UserResponseDto {
        const {passwordHash: _passwordHash, deletedAt: _deletedAt, ...rest} = user;
        return rest;
    }
}
