import type {ConfigService} from '@nestjs/config';

/**
 * The RFC 8414 `issuer` metadata value and the RFC 9207 `iss` authorization
 * response parameter — both must be byte-identical, so this is the single
 * source both well-known.controller.ts and oauth.controller.ts read from
 * rather than each independently calling `config.get('PUBLIC_API_BASE_URL')`.
 * `PUBLIC_API_BASE_URL` is `.required()` in env.validation.ts, so a missing
 * value fails app startup — no fallback needed here.
 */
export const getIssuerUrl = (config: ConfigService): string =>
    config.get<string>('PUBLIC_API_BASE_URL')!;
