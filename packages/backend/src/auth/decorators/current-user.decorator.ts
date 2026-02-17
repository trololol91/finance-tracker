import type {ExecutionContext} from '@nestjs/common';
import {createParamDecorator} from '@nestjs/common';
import type {User} from '#generated/prisma/client.js';

/**
 * Extended request interface with authenticated user
 */
interface RequestWithUser {
    /** Authenticated user from JWT validation */
    user: User;
}

/**
 * Parameter decorator to extract the authenticated user from the request
 * Must be used on routes protected by JwtAuthGuard
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): User => {
        const request = ctx.switchToHttp().getRequest<RequestWithUser>();
        return request.user;
    }
);
