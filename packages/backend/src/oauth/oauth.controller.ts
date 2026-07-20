import {
    Controller, Get, Post, Query, Body, Res, UseGuards, UseFilters, HttpCode, HttpStatus
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import type {Response} from 'express';
import {
    ApiTags, ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiBearerAuth
} from '@nestjs/swagger';
import {
    ThrottlerGuard, Throttle
} from '@nestjs/throttler';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import {API_TOKEN_SCOPES} from '#auth/api-token-scopes.js';
import type {ApiTokenScope} from '#auth/api-token-scopes.js';
import {AdminGuard} from '#common/guards/admin.guard.js';
import {ApiTokensService} from '#api-tokens/api-tokens.service.js';
import type {User} from '#generated/prisma/client.js';
import {OAuthClientsService} from './oauth-clients.service.js';
import {OAuthCodesService} from './oauth-codes.service.js';
import {OAuthInitialAccessTokensService} from './oauth-initial-access-tokens.service.js';
import {verifyPkceChallenge} from './pkce.js';
import {OAuthException} from './oauth-exception.js';
import {OAuthExceptionFilter} from './oauth-exception.filter.js';
import {IatGuard} from './iat.guard.js';
import {AuthorizeQueryDto} from './dto/authorize-query.dto.js';
import {ConsentDecisionDto} from './dto/consent-decision.dto.js';
import {ConsentResponseDto} from './dto/consent-response.dto.js';
import {TokenRequestDto} from './dto/token-request.dto.js';
import {IssueInitialAccessTokenDto} from './dto/issue-initial-access-token.dto.js';
import {InitialAccessTokenResponseDto} from './dto/initial-access-token-response.dto.js';
import {RegisterClientDto} from './dto/register-client.dto.js';
import {RegisterClientResponseDto} from './dto/register-client-response.dto.js';
import {OAUTH_FIXED_SCOPES} from './oauth-scopes.js';

interface TokenResponse {
    access_token: string;
    token_type: 'Bearer';
    scope: string;
}

/**
 * OAuth 2.1 authorization-server endpoints for Claude's custom connector
 * (and, as of Phase 2, any other MCP-compatible OAuth 2.1 client that
 * dynamically registers via /register). The issued token is a normal
 * ApiToken row — nothing downstream (ApiKeyStrategy/ScopesGuard/mcp-server's
 * validateBearerToken) changes. See
 * test-plan/oauth-connector/implementation-plan.md for the full design.
 */
@ApiTags('oauth')
@Controller('oauth')
@UseGuards(ThrottlerGuard)
export class OAuthController {
    constructor(
        private readonly oauthClients: OAuthClientsService,
        private readonly oauthCodes: OAuthCodesService,
        private readonly initialAccessTokens: OAuthInitialAccessTokensService,
        private readonly apiTokens: ApiTokensService,
        private readonly config: ConfigService
    ) {}

    @Get('authorize')
    @Throttle({default: {limit: 20, ttl: 60000}})
    @UseFilters(OAuthExceptionFilter)
    @ApiExcludeEndpoint()
    public async authorize(@Query() query: AuthorizeQueryDto, @Res() res: Response): Promise<void> {
        const client = await this.oauthClients.findByClientId(query.client_id);
        if (!client) {
            throw new OAuthException(HttpStatus.BAD_REQUEST, 'invalid_client', 'Unknown client_id');
        }
        if (!client.redirectUris.includes(query.redirect_uri)) {
            // Never redirect to an unregistered URI — this is an open-redirect
            // vector, so an unrecognised redirect_uri gets a local error instead.
            throw new OAuthException(
                HttpStatus.BAD_REQUEST, 'invalid_request', 'redirect_uri is not registered for this client'
            );
        }

        // redirect_uri is trusted from here on, so remaining validation errors
        // redirect back to the client with error params (RFC 6749 §4.1.2.1)
        // instead of a local error page.
        if (query.response_type !== 'code') {
            this.redirectWithError(res, query.redirect_uri, query.state, 'unsupported_response_type');
            return;
        }
        if (query.code_challenge_method !== 'S256') {
            this.redirectWithError(res, query.redirect_uri, query.state, 'invalid_request');
            return;
        }

        // CORS_ORIGIN is optional (env.validation.ts) — fall back the same way
        // main.ts does, rather than asserting non-null. An unhandled URL
        // constructor throw here isn't an HttpException, so OAuthExceptionFilter
        // wouldn't catch it — a generic 500 instead of a real corsOrigin.
        const corsOrigin = this.config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
        const consentUrl = new URL('/oauth/consent', corsOrigin);
        consentUrl.searchParams.set('client_id', query.client_id);
        // So the consent screen can show WHICH client is asking, instead of a
        // hardcoded name — matters once more than one client can register
        // (implementation plan §11.4). client.clientName is admin/self-supplied
        // at registration time, not attacker-proof on its own; the redirect_uri
        // domain the screen also derives from redirect_uri below is the
        // stronger, unspoofable signal (§11.2).
        consentUrl.searchParams.set('client_name', client.clientName);
        consentUrl.searchParams.set('redirect_uri', query.redirect_uri);
        consentUrl.searchParams.set('code_challenge', query.code_challenge);
        consentUrl.searchParams.set('code_challenge_method', query.code_challenge_method);
        // So the consent screen can render the actual scopes being granted
        // instead of a hardcoded guess that could drift from OAUTH_FIXED_SCOPES
        // (the value consent() actually issues the code with regardless of
        // this param — this only affects what's displayed, not what's granted).
        consentUrl.searchParams.set('scope', OAUTH_FIXED_SCOPES.join(' '));
        if (query.state) consentUrl.searchParams.set('state', query.state);

        res.redirect(consentUrl.toString());
    }

    @Post('consent')
    @UseGuards(JwtAuthGuard)
    @UseFilters(OAuthExceptionFilter)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Approve or deny an OAuth connector request',
        description: 'Called by the frontend consent screen (not by the OAuth client itself). Re-validates client_id/redirect_uri server-side and, on approval, issues an authorization code.'
    })
    @ApiResponse({status: 200, description: 'Where to redirect the browser next', type: ConsentResponseDto})
    @ApiResponse({status: 400, description: 'Unknown client or unregistered redirect_uri'})
    @ApiResponse({status: 401, description: 'Not logged into the frontend session'})
    public async consent(
        @Body() dto: ConsentDecisionDto,
        @CurrentUser() user: User
    ): Promise<ConsentResponseDto> {
        // Re-validated here rather than trusted from the SPA's echoed query
        // params — the SPA is not a security boundary.
        const client = await this.oauthClients.findByClientId(dto.client_id);
        if (!client?.redirectUris.includes(dto.redirect_uri)) {
            throw new OAuthException(
                HttpStatus.BAD_REQUEST, 'invalid_request', 'Unknown client or unregistered redirect_uri'
            );
        }

        const target = new URL(dto.redirect_uri);
        if (dto.state) target.searchParams.set('state', dto.state);

        if (!dto.approved) {
            target.searchParams.set('error', 'access_denied');
            return {redirectTo: target.toString()};
        }

        const code = await this.oauthCodes.issue({
            userId: user.id,
            clientId: dto.client_id,
            redirectUri: dto.redirect_uri,
            scopes: [...OAUTH_FIXED_SCOPES],
            codeChallenge: dto.code_challenge,
            codeChallengeMethod: dto.code_challenge_method
        });

        target.searchParams.set('code', code);
        return {redirectTo: target.toString()};
    }

    @Post('token')
    @Throttle({default: {limit: 5, ttl: 60000}})
    @UseFilters(OAuthExceptionFilter)
    @HttpCode(HttpStatus.OK)
    @ApiExcludeEndpoint()
    public async token(@Body() dto: TokenRequestDto): Promise<TokenResponse> {
        if (dto.grant_type !== 'authorization_code') {
            throw new OAuthException(HttpStatus.BAD_REQUEST, 'unsupported_grant_type', 'Only authorization_code is supported');
        }

        const consumed = await this.oauthCodes.consume(dto.code);
        if (!consumed) {
            throw new OAuthException(HttpStatus.BAD_REQUEST, 'invalid_grant', 'Unknown, expired, or already-used authorization code');
        }
        if (consumed.clientId !== dto.client_id || consumed.redirectUri !== dto.redirect_uri) {
            throw new OAuthException(
                HttpStatus.BAD_REQUEST, 'invalid_grant', 'client_id/redirect_uri do not match the original authorization request'
            );
        }
        if (!verifyPkceChallenge(dto.code_verifier, consumed.codeChallenge)) {
            throw new OAuthException(HttpStatus.BAD_REQUEST, 'invalid_grant', 'code_verifier does not match code_challenge');
        }

        // consumed.scopes round-trips through the DB (OAuthAuthorizationCode.scopes,
        // a bare string[] column) rather than through Nest's ValidationPipe, so
        // ApiTokensService.create()'s @IsIn(API_TOKEN_SCOPES) guard never runs for
        // this call path — re-check the invariant explicitly here instead of
        // trusting a compile-time cast, so a corrupted row or future second
        // caller of oauthCodes.issue() can't mint a token with an invalid scope.
        const isValidScope = (scope: string): scope is ApiTokenScope =>
            (API_TOKEN_SCOPES as readonly string[]).includes(scope);
        if (!consumed.scopes.every(isValidScope)) {
            throw new OAuthException(
                HttpStatus.INTERNAL_SERVER_ERROR, 'server_error', 'Authorization code carried an invalid scope'
            );
        }

        // Name the token after the real client, not a hardcoded "Claude" —
        // matters once more than one client can request a token (§11.4).
        // clientName comes back on consumed itself (oauth-codes.service.ts's
        // deleteByCodeHash() includes it via the client relation) rather than
        // a second findByClientId lookup — consent() already fetched the same
        // client moments earlier, so this avoids a redundant round-trip.
        const issued = await this.apiTokens.create(consumed.userId, consumed.userRole, {
            name: `${consumed.clientName} (OAuth)`,
            scopes: consumed.scopes
        });

        return {
            access_token: issued.token,
            token_type: 'Bearer',
            scope: consumed.scopes.join(' ')
        };
    }

    // No @UseFilters(OAuthExceptionFilter) here, deliberately — this is an
    // admin management endpoint, not an RFC 6749/7591 protocol endpoint, so
    // AdminGuard's 403 should come back in Nest's standard {statusCode,
    // message, error} shape, matching every other AdminGuard-protected
    // endpoint (scraper-admin.controller.ts, admin-users.controller.ts)
    // rather than being reshaped into a misleading {error: 'invalid_request'}.
    @Post('initial-access-tokens')
    @UseGuards(JwtAuthGuard, AdminGuard)
    @HttpCode(HttpStatus.CREATED)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Issue an initial access token for OAuth client registration',
        description: 'Admin-only. Hand the returned token to a new OAuth client\'s own setup flow (often a "registration token" or "DCR token" field) so it can call POST /oauth/register.'
    })
    @ApiResponse({status: 201, description: 'The raw token, shown once', type: InitialAccessTokenResponseDto})
    @ApiResponse({status: 403, description: 'Not an admin'})
    public async issueInitialAccessToken(
        @Body() dto: IssueInitialAccessTokenDto
    ): Promise<InitialAccessTokenResponseDto> {
        return this.initialAccessTokens.issue(dto.label, dto.expiresInHours);
    }

    @Post('register')
    @UseGuards(IatGuard)
    @UseFilters(OAuthExceptionFilter)
    @Throttle({default: {limit: 10, ttl: 3600000}})
    @HttpCode(HttpStatus.CREATED)
    @ApiExcludeEndpoint()
    public async register(@Body() dto: RegisterClientDto): Promise<RegisterClientResponseDto> {
        const client = await this.oauthClients.register(dto);

        return {
            client_id: client.clientId,
            client_name: client.clientName,
            redirect_uris: client.redirectUris,
            token_endpoint_auth_method: client.tokenEndpointAuthMethod,
            grant_types: client.grantTypes,
            response_types: ['code']
        };
    }

    private redirectWithError(
        res: Response, redirectUri: string, state: string | undefined, error: string
    ): void {
        const target = new URL(redirectUri);
        target.searchParams.set('error', error);
        if (state) target.searchParams.set('state', state);
        res.redirect(target.toString());
    }
}
