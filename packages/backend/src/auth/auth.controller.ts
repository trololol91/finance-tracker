import {
    Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import {
    ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth
} from '@nestjs/swagger';
import {AuthService} from '#auth/auth.service.js';
import {FlexibleAuthGuard} from '#auth/guards/flexible-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import {CreateUserDto} from '#users/dto/create-user.dto.js';
import {UserResponseDto} from '#users/dto/user-response.dto.js';
import {LoginDto} from '#auth/dto/login.dto.js';
import {
    AuthResponseDto, SetupStatusResponseDto
} from '#auth/dto/auth-response.dto.js';
import type {AuthResponse} from '#auth/dto/auth-response.dto.js';
import type {User} from '#generated/prisma/client.js';

/**
 * Authentication controller handling user registration, login, and profile access
 */
@ApiTags('auth')
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
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Register a new user', description: 'Create a new user account and receive a JWT token'})
    @ApiBody({type: CreateUserDto})
    @ApiResponse({status: 201, description: 'User successfully registered', type: AuthResponseDto})
    @ApiResponse({status: 409, description: 'Email already exists'})
    @ApiResponse({status: 400, description: 'Invalid input data'})
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
    @HttpCode(HttpStatus.OK)
    @ApiOperation({summary: 'User login', description: 'Authenticate with email and password to receive a JWT token'})
    @ApiBody({type: LoginDto})
    @ApiResponse({status: 200, description: 'Successfully authenticated', type: AuthResponseDto})
    @ApiResponse({status: 401, description: 'Invalid credentials'})
    @ApiResponse({status: 400, description: 'Invalid input data'})
    public async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
        return this.authService.login(loginDto.email, loginDto.password);
    }

    @Get('setup-status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({summary: 'Get setup status', description: 'Returns whether initial setup is required (no users exist)'})
    @ApiResponse({status: 200, description: 'Setup status returned', type: SetupStatusResponseDto})
    public getSetupStatus(): Promise<{required: boolean}> {
        return this.authService.getSetupStatus();
    }

    @Post('setup')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Create first admin account', description: 'Creates the first admin user during initial setup'})
    @ApiBody({type: CreateUserDto})
    @ApiResponse({status: 201, description: 'Admin account created', type: AuthResponseDto})
    @ApiResponse({status: 409, description: 'Setup already complete'})
    public setupAdmin(@Body() createUserDto: CreateUserDto): Promise<AuthResponse> {
        return this.authService.setupAdmin(createUserDto);
    }

    /**
     * Get authenticated user's profile
     * @param user - Current authenticated user from JWT token
     * @returns User profile information
     * @throws {UnauthorizedException} If JWT token is invalid or missing
     */
    // No @RequireScopes — this endpoint is intentionally accessible to any valid token
    // (JWT or API key with any scope). It returns only the authenticated user's own profile
    // and is used by the MCP server as a lightweight token-validation oracle.
    @Get('me')
    @UseGuards(FlexibleAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({summary: 'Get current user profile', description: 'Retrieve the authenticated user\'s profile information'})
    @ApiResponse({status: 200, description: 'User profile retrieved', type: UserResponseDto})
    @ApiResponse({status: 401, description: 'Unauthorized - Invalid or missing JWT token'})
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
            notifyEmail: user.notifyEmail,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
    }
}
