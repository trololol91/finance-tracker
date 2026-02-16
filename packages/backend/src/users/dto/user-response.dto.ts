import type {
    User, UserRole
} from '#generated/prisma/client.js';

export class UserResponseDto {
    id!: string;
    email!: string;
    firstName?: string | null;
    lastName?: string | null;
    emailVerified!: boolean;
    isActive!: boolean;
    timezone!: string;
    currency!: string;
    role!: UserRole;
    createdAt!: Date;
    updatedAt!: Date;

    static fromEntity(user: User): UserResponseDto {
        const {passwordHash: _passwordHash, deletedAt: _deletedAt, ...rest} = user;
        return rest;
    }
}
