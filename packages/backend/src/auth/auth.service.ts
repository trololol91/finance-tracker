import {
    Injectable, UnauthorizedException
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {UsersService} from '#users/users.service.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {User} from '#generated/prisma/client.js';
import type {
    AuthResponse, JwtPayload
} from '#auth/dto/index.js';

// Re-export types for convenience
export type {AuthResponse, JwtPayload} from '#auth/dto/index.js';

/**
 * Authentication service handling user registration, login, and JWT token management
 */
@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService
    ) {}

    /**
     * Register a new user and return authentication credentials
     * @param createUserDto - User registration data
     * @returns Authentication response with access token and user info
     * @throws {ConflictException} If email already exists
     */
    public async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
        const user = await this.usersService.create(createUserDto);
        const accessToken = this.generateToken(user);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            }
        };
    }

    /**
     * Authenticate user with email and password
     * @param email - User email address
     * @param password - User password (plain text)
     * @returns Authentication response with access token and user info
     * @throws {UnauthorizedException} If credentials are invalid
     */
    public async login(email: string, password: string): Promise<AuthResponse> {
        const user = await this.validateUser(email, password);
        const accessToken = this.generateToken(user);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            }
        };
    }

    /**
     * Validate user credentials by checking email and password
     * @param email - User email address
     * @param password - User password (plain text)
     * @returns User object if credentials are valid
     * @throws {UnauthorizedException} If user not found or password is incorrect
     */
    public async validateUser(email: string, password: string): Promise<User> {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }

    /**
     * Generate JWT access token for authenticated user
     * @param user - User object
     * @returns JWT token string
     */
    public generateToken(user: User): string {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email
        };

        return this.jwtService.sign(payload);
    }

    /**
     * Validate JWT payload and retrieve user from database
     * @param payload - JWT payload containing user ID and email
     * @returns User object if found, null otherwise
     */
    public async validateJwtPayload(payload: JwtPayload): Promise<User | null> {
        // TODO: Use payload.sub (user ID) instead of payload.email for lookup
        // This requires handling NotFoundException from findOne() or adding a new method
        // Use findByEmail since it returns User | null instead of throwing
        return this.usersService.findByEmail(payload.email);
    }
}
