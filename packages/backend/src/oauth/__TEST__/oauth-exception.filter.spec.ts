import {
    describe, it, expect, vi
} from 'vitest';
import {
    BadRequestException, HttpException, HttpStatus, UnauthorizedException
} from '@nestjs/common';
import type {ArgumentsHost} from '@nestjs/common';
import type {Response} from 'express';
import {OAuthExceptionFilter} from '#oauth/oauth-exception.filter.js';
import {OAuthException} from '#oauth/oauth-exception.js';

const buildHost = (res: Response): ArgumentsHost => ({
    switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({}),
        getNext: () => undefined
    })
}) as unknown as ArgumentsHost;

describe('OAuthExceptionFilter', () => {
    const filter = new OAuthExceptionFilter();

    it('passes an OAuthException body through unchanged', () => {
        const res = {status: vi.fn().mockReturnThis(), json: vi.fn()} as unknown as Response;
        const exception = new OAuthException(HttpStatus.BAD_REQUEST, 'invalid_grant', 'code expired');

        filter.catch(exception, buildHost(res));

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({error: 'invalid_grant', error_description: 'code expired'});
    });

    it('reshapes class-validator\'s default {message: [...]} array into a single description', () => {
        const res = {status: vi.fn().mockReturnThis(), json: vi.fn()} as unknown as Response;
        const exception = new BadRequestException(['client_id must be a string', 'redirect_uri should not be empty']);

        filter.catch(exception, buildHost(res));

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'invalid_request',
            error_description: 'client_id must be a string; redirect_uri should not be empty'
        });
    });

    it('reshapes a generic HttpException with a string body', () => {
        const res = {status: vi.fn().mockReturnThis(), json: vi.fn()} as unknown as Response;
        const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

        filter.catch(exception, buildHost(res));

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({error: 'invalid_request', error_description: 'Forbidden'});
    });

    it('maps JwtAuthGuard\'s 401 to "unauthorized", not "invalid_request"', () => {
        const res = {status: vi.fn().mockReturnThis(), json: vi.fn()} as unknown as Response;
        const exception = new UnauthorizedException();

        filter.catch(exception, buildHost(res));

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error: 'unauthorized'}));
    });

    it('maps ThrottlerGuard\'s 429 to "slow_down", not "invalid_request"', () => {
        const res = {status: vi.fn().mockReturnThis(), json: vi.fn()} as unknown as Response;
        const exception = new HttpException('ThrottlerException: Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);

        filter.catch(exception, buildHost(res));

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error: 'slow_down'}));
    });

    it('maps a 5xx to "server_error", not "invalid_request"', () => {
        const res = {status: vi.fn().mockReturnThis(), json: vi.fn()} as unknown as Response;
        const exception = new HttpException('Internal', HttpStatus.INTERNAL_SERVER_ERROR);

        filter.catch(exception, buildHost(res));

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error: 'server_error'}));
    });
});
