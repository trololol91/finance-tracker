import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException
} from '@nestjs/common';
import type {User} from '#generated/prisma/client.js';

/**
 * Guard that restricts access to ADMIN role users only.
 * Must be used after JwtAuthGuard so `request.user` is populated.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, AdminGuard)
 * @Post('admin/scrapers/reload')
 * reload() { ... }
 * ```
 */
@Injectable()
export class AdminGuard implements CanActivate {
    public canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<{user: User}>();
        const user = request.user;

        if (user.role !== 'ADMIN') {
            throw new ForbiddenException('Admin access required');
        }

        return true;
    }
}
