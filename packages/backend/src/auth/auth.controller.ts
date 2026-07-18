import {
    Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Res, Req
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import type {
    Request, Response
} from 'express';
import {
    ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiCookieAuth
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
import type {
    AuthResult, AuthResponse
} from '#auth/auth.service.js';
import type {IssuedRefreshToken} from '#auth/refresh-tokens.service.js';
import type {User} from '#generated/prisma/client.js';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
// Scoped to /api/auth so the cookie is only ever sent to the login/refresh/logout
// endpoints that need it, not on every request.
const REFRESH_TOKEN_COOKIE_PATH = '/api/auth';

/**
 * Authentication controller handling user registration, login, and profile access
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: ConfigService
    ) {}

    /**
     * Register a new user account
     * @param createUserDto - User registration data
     * @param res - Response used to set the refresh token cookie
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
    public async register(
        @Body() createUserDto: CreateUserDto,
        @Res({passthrough: true}) res: Response
    ): Promise<AuthResponse> {
        const result = await this.authService.register(createUserDto);
        this.setRefreshCookie(res, result.refreshToken);
        return result.authResponse;
    }

    /**
     * Authenticate user and generate JWT token
     * @param loginDto - User login credentials
     * @param res - Response used to set the refresh token cookie
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
    public async login(
        @Body() loginDto: LoginDto,
        @Res({passthrough: true}) res: Response
    ): Promise<AuthResponse> {
        const result = await this.authService.login(
            loginDto.email, loginDto.password, loginDto.rememberMe ?? false
        );
        this.setRefreshCookie(res, result.refreshToken);
        return result.authResponse;
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
    public async setupAdmin(
        @Body() createUserDto: CreateUserDto,
        @Res({passthrough: true}) res: Response
    ): Promise<AuthResponse> {
        const result = await this.authService.setupAdmin(createUserDto);
        this.setRefreshCookie(res, result.refreshToken);
        return result.authResponse;
    }

    /**
     * Exchange the refresh token cookie for a new access token, rotating the cookie.
     * No guard — this endpoint authenticates via the refresh token cookie itself.
     * @param req - Request carrying the `refresh_token` cookie
     * @param res - Response used to set the rotated refresh token cookie
     * @returns Authentication response with a new JWT access token and user info
     * @throws {UnauthorizedException} If the refresh token is missing, invalid, or expired
     */
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiCookieAuth()
    @ApiOperation({summary: 'Refresh access token', description: 'Exchange a valid refresh token cookie for a new access token'})
    @ApiResponse({status: 200, description: 'Token refreshed', type: AuthResponseDto})
    @ApiResponse({status: 401, description: 'Missing, invalid, or expired refresh token'})
    public async refresh(
        @Req() req: Request,
        @Res({passthrough: true}) res: Response
    ): Promise<AuthResponse> {
        const result: AuthResult = await this.authService.refresh(this.readRefreshCookie(req));
        this.setRefreshCookie(res, result.refreshToken);
        return result.authResponse;
    }

    /**
     * Revoke the refresh token cookie and clear it.
     * @param req - Request carrying the `refresh_token` cookie
     * @param res - Response used to clear the refresh token cookie
     */
    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiCookieAuth()
    @ApiOperation({summary: 'Log out', description: 'Revoke the current refresh token and clear its cookie'})
    @ApiResponse({status: 204, description: 'Logged out'})
    public async logout(
        @Req() req: Request,
        @Res({passthrough: true}) res: Response
    ): Promise<void> {
        await this.authService.logout(this.readRefreshCookie(req));
        res.clearCookie(REFRESH_TOKEN_COOKIE, {path: REFRESH_TOKEN_COOKIE_PATH});
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

    private readRefreshCookie(req: Request): string | undefined {
        const cookies = req.cookies as Record<string, string> | undefined;
        return cookies?.[REFRESH_TOKEN_COOKIE];
    }

    private setRefreshCookie(res: Response, refreshToken: IssuedRefreshToken): void {
        res.cookie(REFRESH_TOKEN_COOKIE, refreshToken.rawToken, {
            httpOnly: true,
            secure: this.config.get<string>('NODE_ENV') === 'production',
            sameSite: 'lax',
            path: REFRESH_TOKEN_COOKIE_PATH,
            // Omitting maxAge for a non-"remember me" login makes this a session
            // cookie that the browser clears on its own when it fully closes.
            ...(refreshToken.rememberMe
                ? {expires: refreshToken.expiresAt}
                : {})
        });
    }
}
