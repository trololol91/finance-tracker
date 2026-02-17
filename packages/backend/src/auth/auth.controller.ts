import {
    Controller, Post, Get, Body, UseGuards
} from '@nestjs/common';
import {AuthService} from '#auth/auth.service.js';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import {CreateUserDto} from '#users/dto/create-user.dto.js';
import {UserResponseDto} from '#users/dto/user-response.dto.js';
import {LoginDto} from '#auth/dto/index.js';
import type {AuthResponse} from '#auth/dto/index.js';
import type {User} from '#generated/prisma/client.js';

/**
 * Authentication controller handling user registration, login, and profile access
 */
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    /**
     * Register a new user account
     * @param createUserDto - User registration data
     * @returns Authentication response with JWT token and user info
     * @throws {ConflictException} If email is already registered
     */
    @Post('register')
    public async register(@Body() createUserDto: CreateUserDto): Promise<AuthResponse> {
        return this.authService.register(createUserDto);
    }

    /**
     * Authenticate user and generate JWT token
     * @param loginDto - User login credentials
     * @returns Authentication response with JWT token and user info
     * @throws {UnauthorizedException} If credentials are invalid
     */
    @Post('login')
    public async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
        return this.authService.login(loginDto.email, loginDto.password);
    }

    /**
     * Get authenticated user's profile
     * @param user - Current authenticated user from JWT token
     * @returns User profile information
     * @throws {UnauthorizedException} If JWT token is invalid or missing
     */
    @Get('me')
    @UseGuards(JwtAuthGuard)
    public getProfile(@CurrentUser() user: User): UserResponseDto {
        return {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            firstName: user.firstName,
            lastName: user.lastName,
            timezone: user.timezone,
            currency: user.currency,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
    }
}
