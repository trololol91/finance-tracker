import {Injectable} from '@nestjs/common';
import {AuthGuard} from '@nestjs/passport';

/**
 * Guard that protects routes by validating JWT tokens
 * Uses the 'jwt' Passport strategy configured in JwtStrategy
 * @example
 * ```typescript
 * @Get('protected')
 * @UseGuards(JwtAuthGuard)
 * protectedRoute() {
 *   return 'This is protected';
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
