import Joi from 'joi';

export const VALID_PROVIDERS = ['anthropic', 'openai'] as const;
export type AiProvider = typeof VALID_PROVIDERS[number];

export const envValidationSchema = Joi.object({
    // App
    PORT: Joi.number().integer().min(1).max(65535).default(3001),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

    // Database
    DATABASE_URL: Joi.string().required(),

    // Auth — duration format: an integer followed by one of s/m/h/d
    // (e.g. "15m", "30d"). Must match RefreshTokensService's parseDurationMs.
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('15m'),
    JWT_REFRESH_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('30d'),

    // Encryption — 64-char hex string = 32-byte AES-256 key
    CREDENTIALS_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),

    // Frontend origin — used to build absolute URLs in push/email notifications
    CORS_ORIGIN: Joi.string().uri().optional(),

    // OAuth 2.1 authorization server (Claude custom connector)
    // Absolute base URL the backend is reachable at from the internet — used to
    // build the RFC 8414 metadata document's absolute endpoint URLs. Distinct
    // from CORS_ORIGIN (that's the frontend's origin).
    PUBLIC_API_BASE_URL: Joi.string().uri().required(),
    // Phase 1 static client (no dynamic client registration yet) — see
    // test-plan/oauth-connector/implementation-plan.md.
    OAUTH_STATIC_CLIENT_ID: Joi.string().required(),
    // Comma-separated list of redirect URIs registered for the static client.
    OAUTH_STATIC_REDIRECT_URIS: Joi.string().required(),

    // AI Categorization
    AI_PROVIDER: Joi.string().valid(...VALID_PROVIDERS).default('anthropic'),
    AI_MODEL: Joi.string().default('claude-haiku-4-5-20251001'),
    ANTHROPIC_API_KEY: Joi.string().optional().allow(''),
    OPENAI_API_KEY: Joi.string().optional().allow('')
}).options({allowUnknown: true}); // allow OS/Docker env vars not owned by this app
