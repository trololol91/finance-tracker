import {
    Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {PrismaService} from '#database/prisma.service.js';
import type {User} from '#generated/prisma/client.js';
import {CreateUserDto} from './dto/create-user.dto.js';
import {UpdateUserDto} from './dto/update-user.dto.js';
import type {AdminUserListItemDto} from './dto/admin-user-list-item.dto.js';
import type {UserRole} from '#generated/prisma/enums.js';
import {CategoriesService} from '#categories/categories.service.js';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly categoriesService: CategoriesService
    ) {}

    /**
     * Create a new user with hashed password
     */
    public async create(createUserDto: CreateUserDto): Promise<User> {
        // Check if email already exists
        const existingUser: User | null = await this.prisma.user.findUnique({
            where: {email: createUserDto.email}
        });

        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash: string = await bcrypt.hash(createUserDto.password, saltRounds);

        // Create user and seed default categories atomically
        const user: User = await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    email: createUserDto.email,
                    passwordHash,
                    firstName: createUserDto.firstName,
                    lastName: createUserDto.lastName,
                    timezone: createUserDto.timezone ?? 'UTC',
                    currency: createUserDto.currency ?? 'USD'
                }
            });
            await this.categoriesService.seedDefaultCategories(created.id, tx);
            return created;
        });

        return user;
    }

    /**
     * Find user by ID (excluding deleted users)
     * Enforces that users can only access their own profile (unless admin)
     * @param authenticatedUserId - ID of the authenticated user making the request
     * @param targetUserId - ID of the user to retrieve
     */
    public async findOne(authenticatedUserId: string, targetUserId: string): Promise<User> {
        // Verify ownership: user can only access their own profile
        if (authenticatedUserId !== targetUserId) {
            throw new ForbiddenException('You can only access your own profile');
        }

        const user: User | null = await this.prisma.user.findFirst({
            where: {
                id: targetUserId,
                deletedAt: null
            }
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${targetUserId} not found`);
        }

        return user;
    }

    /**
     * Find user by email (for authentication)
     */
    public async findByEmail(email: string): Promise<User | null> {
        const user: User | null = await this.prisma.user.findFirst({
            where: {
                email,
                deletedAt: null
            }
        });

        return user;
    }

    /**
     * Update user information
     * Enforces that users can only update their own profile
     * @param authenticatedUserId - ID of the authenticated user making the request
     * @param targetUserId - ID of the user to update
     * @param updateUserDto - User data to update
     */
    public async update(
        authenticatedUserId: string,
        targetUserId: string,
        updateUserDto: UpdateUserDto
    ): Promise<User> {
        // Verify ownership: user can only update their own profile
        if (authenticatedUserId !== targetUserId) {
            throw new ForbiddenException('You can only update your own profile');
        }

        // Verify user exists
        await this.findOne(authenticatedUserId, targetUserId);

        const user: User = await this.prisma.user.update({
            where: {id: targetUserId},
            data: {
                firstName: updateUserDto.firstName,
                lastName: updateUserDto.lastName,
                timezone: updateUserDto.timezone,
                currency: updateUserDto.currency,
                isActive: updateUserDto.isActive,
                notifyPush: updateUserDto.notifyPush,
                notifyEmail: updateUserDto.notifyEmail
            }
        });

        return user;
    }

    public async findAllForAdmin(): Promise<AdminUserListItemDto[]> {
        const users = await this.prisma.user.findMany({
            where: {deletedAt: null},
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                createdAt: true
            },
            orderBy: {createdAt: 'asc'}
        });
        return users;
    }

    /**
     * Update a user's role.
     * Enforces that an admin cannot change their own role.
     */
    public async updateRole(
        requestingUserId: string,
        userId: string,
        role: UserRole
    ): Promise<AdminUserListItemDto> {
        if (requestingUserId === userId) {
            throw new BadRequestException('You cannot change your own role');
        }

        const user = await this.prisma.user.findFirst({
            where: {id: userId, deletedAt: null}
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const updated = await this.prisma.user.update({
            where: {id: userId},
            data: {role},
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });

        return updated;
    }

    public async hasUsers(): Promise<boolean> {
        const count = await this.prisma.user.count();
        return count > 0;
    }

    public async promoteToAdmin(id: string): Promise<void> {
        await this.prisma.user.update({
            where: {id},
            data: {role: 'ADMIN'}
        });
    }

    /**
     * Soft delete user by setting deletedAt timestamp
     * Enforces that users can only delete their own account
     * @param authenticatedUserId - ID of the authenticated user making the request
     * @param targetUserId - ID of the user to delete
     */
    public async remove(authenticatedUserId: string, targetUserId: string): Promise<User> {
        // Verify ownership: user can only delete their own account
        if (authenticatedUserId !== targetUserId) {
            throw new ForbiddenException('You can only delete your own account');
        }

        // Verify user exists
        await this.findOne(authenticatedUserId, targetUserId);

        const user: User = await this.prisma.user.update({
            where: {id: targetUserId},
            data: {
                deletedAt: new Date(),
                isActive: false
            }
        });

        return user;
    }
}
