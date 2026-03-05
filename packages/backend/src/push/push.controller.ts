import {
    Controller,
    Post,
    Delete,
    Body,
    HttpCode,
    UseGuards
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import {PushService} from '#push/push.service.js';
import {SubscribePushDto} from '#push/dto/subscribe-push.dto.js';
import {UnsubscribePushDto} from '#push/dto/unsubscribe-push.dto.js';
import type {User} from '#generated/prisma/client.js';

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
    constructor(private readonly pushService: PushService) {}

    /**
     * Register a Web Push subscription for the authenticated user.
     * Call this on every Service Worker registration to keep the server
     * in sync with the browser's push endpoint.
     */
    @Post('subscribe')
    @HttpCode(201)
    @ApiOperation({summary: 'Register a Web Push subscription'})
    @ApiResponse({status: 201, description: 'Subscription registered successfully'})
    @ApiResponse({status: 400, description: 'Invalid subscription payload'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public subscribe(
        @CurrentUser() user: User,
        @Body() dto: SubscribePushDto
    ): {message: string} {
        this.pushService.subscribe(user.id, dto);
        return {message: 'Subscribed to push notifications.'};
    }

    /**
     * Remove a Web Push subscription.
     * Should be called when the user explicitly opts out or when a
     * service worker unregisters a push subscription.
     */
    @Delete('subscribe')
    @HttpCode(204)
    @ApiOperation({summary: 'Remove a Web Push subscription'})
    @ApiResponse({status: 204, description: 'Subscription removed successfully'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public unsubscribe(
        @CurrentUser() user: User,
        @Body() dto: UnsubscribePushDto
    ): void {
        this.pushService.unsubscribe(user.id, dto.endpoint);
    }
}
