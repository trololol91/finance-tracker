import Joi from 'joi';

export const VALID_PROVIDERS = ['anthropic', 'openai'] as const;
export type AiProvider = typeof VALID_PROVIDERS[number];

export const envValidationSchema = Joi.object({
    // App
    PORT: Joi.number().integer().min(1).max(65535).default(3001),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

    // Database
    DATABASE_URL: Joi.string().required(),

    // Auth
    JWT_SECRET: Joi.string().min(32).required(),

    // Encryption — 64-char hex string = 32-byte AES-256 key
    CREDENTIALS_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),

    // Frontend origin — used to build absolute URLs in push/email notifications
    CORS_ORIGIN: Joi.string().uri().optional(),

    // AI Categorization
    AI_PROVIDER: Joi.string().valid(...VALID_PROVIDERS).default('anthropic'),
    AI_MODEL: Joi.string().default('claude-haiku-4-5-20251001'),
    ANTHROPIC_API_KEY: Joi.string().optional().allow(''),
    OPENAI_API_KEY: Joi.string().optional().allow('')
}).options({allowUnknown: true}); // allow OS/Docker env vars not owned by this app
