import {
    Logger, Module, type OnModuleInit
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ThrottlerModule} from '@nestjs/throttler';
import {DatabaseModule} from '#database/database.module.js';
import {ApiTokensModule} from '#api-tokens/api-tokens.module.js';
import {OAuthController} from './oauth.controller.js';
import {WellKnownController} from './well-known.controller.js';
import {OAuthClientsService} from './oauth-clients.service.js';
import {OAuthCodesService} from './oauth-codes.service.js';

@Module({
    imports: [
        DatabaseModule,
        ApiTokensModule,
        // Scoped to OAuthController only (via @UseGuards(ThrottlerGuard) there),
        // not registered as a global APP_GUARD — /authorize, /token, and
        // /register are classic abuse targets, but nothing else in this
        // backend should be affected by adding this dependency.
        ThrottlerModule.forRoot([{name: 'default', ttl: 60000, limit: 20}])
    ],
    controllers: [OAuthController, WellKnownController],
    providers: [OAuthClientsService, OAuthCodesService]
})
export class OAuthModule implements OnModuleInit {
    private readonly logger = new Logger(OAuthModule.name);

    constructor(
        private readonly oauthClientsService: OAuthClientsService,
        private readonly config: ConfigService
    ) {}

    /**
     * Idempotent upsert of the Phase 1 static client on every boot, so
     * updating OAUTH_STATIC_REDIRECT_URIS and restarting is enough to change
     * the registered redirect URI — no migration or manual DB edit needed.
     *
     * Errors are caught, not rethrown: NestFactory.create() awaits every
     * OnModuleInit hook before app.listen() runs, so an unhandled rejection
     * here would take down the entire backend's HTTP listener over a problem
     * scoped to one OAuth config row — better to boot with a stale/missing
     * static client (which just makes /oauth/authorize 400 with
     * invalid_client until the next successful restart) than not boot at all.
     */
    public async onModuleInit(): Promise<void> {
        const clientId = this.config.get<string>('OAUTH_STATIC_CLIENT_ID');
        const redirectUrisRaw = this.config.get<string>('OAUTH_STATIC_REDIRECT_URIS');
        if (!clientId || !redirectUrisRaw) return;

        const redirectUris = redirectUrisRaw.split(',').map(uri => uri.trim()).filter(Boolean);
        try {
            await this.oauthClientsService.ensureStaticClient(clientId, redirectUris);
        } catch (err) {
            this.logger.error(
                'Failed to sync the static OAuth client at startup — /oauth/authorize will 400 until this succeeds',
                err instanceof Error ? err.stack : undefined
            );
        }
    }
}
