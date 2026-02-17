import {
    Injectable, UnauthorizedException
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PassportStrategy} from '@nestjs/passport';
import {
    ExtractJwt, Strategy
} from 'passport-jwt';
import type {User} from '#generated/prisma/client.js';
import {AuthService} from '#auth/auth.service.js';
import type {JwtPayload} from '#auth/auth.service.js';

/**
 * JWT authentication strategy for Passport
 * Validates JWT tokens from Authorization header and loads user data
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    /**
     * Initialize JWT strategy with configuration
     * @param authService - Service to validate JWT payload and load user
     * @param configService - Configuration service to read JWT secret
     */
    constructor(
        private readonly authService: AuthService,
        configService: ConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') ?? 'default-secret'
        });
    }

    /**
     * Validate JWT payload and return authenticated user
     * Called automatically by Passport after token verification
     * @param payload - Decoded JWT payload containing user ID and email
     * @returns User object if valid
     * @throws {UnauthorizedException} If user not found or payload invalid
     */
    public async validate(payload: JwtPayload): Promise<User> {
        const user: User | null = await this.authService.validateJwtPayload(payload);

        if (!user) {
            throw new UnauthorizedException();
        }

        return user;
    }
}
