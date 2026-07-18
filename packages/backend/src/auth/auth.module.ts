import {Module} from '@nestjs/common';
import {JwtModule} from '@nestjs/jwt';
import type {JwtModuleOptions} from '@nestjs/jwt';
import {PassportModule} from '@nestjs/passport';
import {ConfigService} from '@nestjs/config';

type JwtExpiresIn = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];
import {AuthService} from '#auth/auth.service.js';
import {AuthController} from '#auth/auth.controller.js';
import {RefreshTokensService} from '#auth/refresh-tokens.service.js';
import {JwtStrategy} from '#auth/strategies/jwt.strategy.js';
import {ApiKeyStrategy} from '#auth/strategies/api-key.strategy.js';
import {FlexibleAuthGuard} from '#auth/guards/flexible-auth.guard.js';
import {ScopesGuard} from '#auth/guards/scopes.guard.js';
import {UsersModule} from '#users/users.module.js';

/**
 * Authentication module providing JWT-based authentication
 * Configures Passport strategies, JWT signing, and auth endpoints
 */
@Module({
    imports: [
        UsersModule,
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') ?? 'default-secret',
                signOptions: {expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? '15m') as JwtExpiresIn}
            })
        })
    ],
    controllers: [AuthController],
    providers: [
        AuthService, RefreshTokensService, JwtStrategy,
        ApiKeyStrategy, FlexibleAuthGuard, ScopesGuard
    ],
    exports: [AuthService, FlexibleAuthGuard, ScopesGuard]
})
export class AuthModule {}
