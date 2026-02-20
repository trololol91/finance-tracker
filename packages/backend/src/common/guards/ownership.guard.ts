import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException
} from '@nestjs/common';
import type {User} from '#generated/prisma/client.js';

/**
 * Guard to ensure users can only access their own resources
 * Compares the authenticated user's ID with the resource ID in route params
 * 
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, OwnershipGuard)
 * @Get(':id')
 * findOne(@Param('id') id: string, @CurrentUser() user: User) {
 *   // User can only access their own profile
 * }
 * ```
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
    /**
     * Validates that the authenticated user owns the requested resource
     * @param context - Execution context containing request and route info
     * @returns true if user owns the resource, throws ForbiddenException otherwise
     */
    public canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<{
            user: User;
            params: Record<string, string>;
        }>();

        const user = request.user;
        const resourceId = request.params.id;

        // Admin users can access any resource (future enhancement)
        if (user.role === 'ADMIN') {
            return true;
        }

        // Check if the authenticated user's ID matches the resource ID
        if (user.id !== resourceId) {
            throw new ForbiddenException(
                'You do not have permission to access this resource'
            );
        }

        return true;
    }
}
