import {
    Injectable, ConflictException, NotFoundException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {PrismaService} from '#database/prisma.service.js';
import type {User} from '#generated/prisma/client.js';
import {CreateUserDto} from './dto/create-user.dto.js';
import {UpdateUserDto} from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

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

        // Create user
        const user: User = await this.prisma.user.create({
            data: {
                email: createUserDto.email,
                passwordHash,
                firstName: createUserDto.firstName,
                lastName: createUserDto.lastName,
                timezone: createUserDto.timezone ?? 'UTC',
                currency: createUserDto.currency ?? 'USD'
            }
        });

        return user;
    }

    /**
     * Find user by ID (excluding deleted users)
     */
    public async findOne(id: string): Promise<User> {
        const user: User | null = await this.prisma.user.findFirst({
            where: {
                id,
                deletedAt: null
            }
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
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
     */
    public async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        // Verify user exists
        await this.findOne(id);

        const user: User = await this.prisma.user.update({
            where: {id},
            data: {
                firstName: updateUserDto.firstName,
                lastName: updateUserDto.lastName,
                timezone: updateUserDto.timezone,
                currency: updateUserDto.currency,
                isActive: updateUserDto.isActive
            }
        });

        return user;
    }

    /**
     * Soft delete user by setting deletedAt timestamp
     */
    public async remove(id: string): Promise<User> {
        // Verify user exists
        await this.findOne(id);

        const user: User = await this.prisma.user.update({
            where: {id},
            data: {
                deletedAt: new Date(),
                isActive: false
            }
        });

        return user;
    }
}
