import {
    Controller, Get
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ApiExcludeController} from '@nestjs/swagger';
import {OAUTH_FIXED_SCOPES} from './oauth-scopes.js';

interface OAuthAuthorizationServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    response_types_supported: string[];
    grant_types_supported: string[];
    code_challenge_methods_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    scopes_supported: string[];
}

/**
 * RFC 8414 authorization-server metadata. Registered with a bare
 * @Controller() (no 'oauth' prefix) and excluded from the global /api prefix
 * in main.ts, since this well-known path is conventionally expected at the
 * site root — unlike /oauth/authorize etc., which stay under /api and are
 * only ever reached via the absolute URLs this document hands out.
 */
@ApiExcludeController()
@Controller()
export class WellKnownController {
    constructor(private readonly config: ConfigService) {}

    @Get('.well-known/oauth-authorization-server')
    public getAuthorizationServerMetadata(): OAuthAuthorizationServerMetadata {
        const baseUrl = this.config.get<string>('PUBLIC_API_BASE_URL')!;

        return {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
            token_endpoint: `${baseUrl}/api/oauth/token`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
            scopes_supported: [...OAUTH_FIXED_SCOPES]
        };
    }
}
