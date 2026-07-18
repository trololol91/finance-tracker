import {
    Injectable, UnauthorizedException, ConflictException
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {UsersService} from '#users/users.service.js';
import {RefreshTokensService} from '#auth/refresh-tokens.service.js';
import type {IssuedRefreshToken} from '#auth/refresh-tokens.service.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {User} from '#generated/prisma/client.js';
import type {
    AuthResponse, JwtPayload
} from '#auth/dto/auth-response.dto.js';

// Re-export types for convenience
export type {AuthResponse, JwtPayload} from '#auth/dto/auth-response.dto.js';

export interface AuthResult {
    authResponse: AuthResponse;
    refreshToken: IssuedRefreshToken;
}

/**
 * Authentication service handling user registration, login, and JWT token management
 */
@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly refreshTokensService: RefreshTokensService
    ) {}

    /**
     * Register a new user and return authentication credentials
     * @param createUserDto - User registration data
     * @returns Authentication response with access token, refresh token, and user info
     * @throws {ConflictException} If email already exists
     */
    public async register(createUserDto: CreateUserDto): Promise<AuthResult> {
        const user = await this.usersService.create(createUserDto);
        return this.buildAuthResult(user, false);
    }

    /**
     * Authenticate user with email and password
     * @param email - User email address
     * @param password - User password (plain text)
     * @param rememberMe - Whether the refresh token should persist across browser sessions
     * @returns Authentication response with access token, refresh token, and user info
     * @throws {UnauthorizedException} If credentials are invalid
     */
    public async login(email: string, password: string, rememberMe: boolean): Promise<AuthResult> {
        const user = await this.validateUser(email, password);
        return this.buildAuthResult(user, rememberMe);
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

    public async getSetupStatus(): Promise<{required: boolean}> {
        const hasUsers = await this.usersService.hasUsers();
        return {required: !hasUsers};
    }

    public async setupAdmin(createUserDto: CreateUserDto): Promise<AuthResult> {
        const hasUsers = await this.usersService.hasUsers();
        if (hasUsers) {
            throw new ConflictException('Setup already complete');
        }
        const user = await this.usersService.create(createUserDto);
        await this.usersService.promoteToAdmin(user.id);
        return this.buildAuthResult(user, false);
    }

    /**
     * Exchange a valid refresh token for a new access token, rotating the refresh token.
     * @param rawRefreshToken - The raw refresh token from the `refresh_token` cookie
     * @throws {UnauthorizedException} If the refresh token is missing, unknown, expired, or reused
     *   outside the rotation grace period
     */
    public async refresh(rawRefreshToken: string | undefined): Promise<AuthResult> {
        if (!rawRefreshToken) {
            throw new UnauthorizedException('Missing refresh token');
        }

        const rotated = await this.refreshTokensService.validateAndRotate(rawRefreshToken);
        if (!rotated) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.usersService.findOne(rotated.userId, rotated.userId);

        return {
            authResponse: this.toAuthResponse(user),
            refreshToken: {
                rawToken: rotated.rawToken,
                expiresAt: rotated.expiresAt,
                rememberMe: rotated.rememberMe
            }
        };
    }

    /**
     * Revoke a refresh token (best-effort — used on logout).
     * @param rawRefreshToken - The raw refresh token from the `refresh_token` cookie
     */
    public async logout(rawRefreshToken: string | undefined): Promise<void> {
        if (!rawRefreshToken) return;
        await this.refreshTokensService.revoke(rawRefreshToken);
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

    private async buildAuthResult(user: User, rememberMe: boolean): Promise<AuthResult> {
        const refreshToken = await this.refreshTokensService.issue(user.id, rememberMe);
        return {authResponse: this.toAuthResponse(user), refreshToken};
    }

    private toAuthResponse(user: User): AuthResponse {
        return {
            accessToken: this.generateToken(user),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            }
        };
    }
}
