import {Module} from '@nestjs/common';
import {DatabaseModule} from '#database/database.module.js';
import {PushController} from '#push/push.controller.js';
import {PushService} from '#push/push.service.js';
import {PushSubscriptionStore} from '#push/push-subscription.store.js';

/**
 * PushModule provides Web Push VAPID and email alert delivery for the
 * scraper MFA flow.
 *
 * Exports `PushService` so that ScraperModule can inject it into
 * ScraperService without circular-dependency issues.
 */
@Module({
    imports: [DatabaseModule],
    controllers: [PushController],
    providers: [PushService, PushSubscriptionStore],
    exports: [PushService]
})
export class PushModule {}
