import {
    Catch, HttpException, HttpStatus
} from '@nestjs/common';
import type {
    ExceptionFilter, ArgumentsHost
} from '@nestjs/common';
import type {Response} from 'express';

interface OAuthErrorBody {
    error: string;
    error_description?: string;
}

// Nest's default validation-error body also happens to have a string `error`
// field (the HTTP status text, e.g. "Bad Request") — excluding `statusCode`/
// `message` distinguishes an actual {error, error_description} body (thrown
// via OAuthException) from that generic shape, which still needs reshaping.
const isOAuthErrorBody = (body: unknown): body is OAuthErrorBody =>
    typeof body === 'object' && body !== null
    && typeof (body as {error?: unknown}).error === 'string'
    && !('statusCode' in body) && !('message' in body);

const describe = (body: unknown, fallback: string): string => {
    if (typeof body === 'string') return body;
    const message = (body as {message?: unknown} | null)?.message;
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
    return fallback;
};

// The fallback branch below handles more than validation errors — guards on
// this controller (JwtAuthGuard's 401 on /consent, ThrottlerGuard's 429 on
// all three routes) also raise plain HttpExceptions here, and neither is an
// "invalid_request" per RFC 6749 §5.2. Map the common non-2xx classes to a
// code that isn't actively misleading; anything else still defaults to
// invalid_request, which is at least correct for the validation-pipe case
// this filter was originally written for.
const errorCodeForStatus = (status: number): string => {
    if (status === 429) return 'slow_down'; // HttpStatus.TOO_MANY_REQUESTS
    if (status === 401) return 'unauthorized'; // HttpStatus.UNAUTHORIZED
    if (status >= 500) return 'server_error';
    return 'invalid_request';
};

/**
 * Reshapes any HttpException raised within the OAuth controllers into the
 * RFC 6749 §5.2 {error, error_description} error body — OAuth clients
 * (including the MCP SDK's own token-exchange code) parse this specific
 * shape, not Nest's default {statusCode, message, error}.
 */
@Catch(HttpException)
export class OAuthExceptionFilter implements ExceptionFilter {
    public catch(exception: HttpException, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();
        const status = exception.getStatus();
        const body: unknown = exception.getResponse();

        if (isOAuthErrorBody(body)) {
            response.status(status).json(body);
            return;
        }

        const safeStatus = status >= 400 && status < 600 ? status : HttpStatus.BAD_REQUEST;
        response.status(safeStatus).json({
            error: errorCodeForStatus(safeStatus),
            error_description: describe(body, exception.message)
        });
    }
}
