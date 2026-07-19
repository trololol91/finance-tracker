import {HttpException} from '@nestjs/common';

/**
 * An HttpException whose response body is already the RFC 6749 §5.2
 * {error, error_description} shape OAuthExceptionFilter expects — throwing
 * this instead of a plain HttpException lets the filter pass the body
 * through unchanged rather than remapping a generic Nest error shape.
 */
export class OAuthException extends HttpException {
    constructor(status: number, error: string, errorDescription?: string) {
        super({error, error_description: errorDescription}, status);
    }
}
