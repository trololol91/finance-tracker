import {
    describe, it, expect
} from 'vitest';
import {ValidationPipe} from '@nestjs/common';
import {AuthorizeQueryDto} from '#oauth/dto/authorize-query.dto.js';

// Matches main.ts's global pipe exactly — this is the thing that actually
// rejected Claude's real /oauth/authorize request in production
// ({"error":"invalid_request","error_description":"property scope should
// not exist; property resource should not exist"}), not something a plain
// class-validator `validate()` call on the DTO in isolation would catch
// (forbidNonWhitelisted is a NestJS ValidationPipe behavior layered on top
// of class-validator/class-transformer, not a class-validator feature).
const pipe = new ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true});

const baseQuery = {
    response_type: 'code',
    client_id: 'claude-ai',
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: 'challenge-value',
    code_challenge_method: 'S256',
    state: 'xyz'
};

describe('AuthorizeQueryDto (real ValidationPipe)', () => {
    it('accepts a real Claude /authorize request carrying scope and resource (RFC 6749 §3.3 / RFC 8707)', async () => {
        const claudeQuery = {
            ...baseQuery,
            scope: 'transactions:read transactions:write accounts:read categories:read dashboard:read',
            resource: 'https://finance.riol.ca/mcp'
        };

        await expect(pipe.transform(claudeQuery, {type: 'query', metatype: AuthorizeQueryDto})).resolves.toBeInstanceOf(AuthorizeQueryDto);
    });

    it('still rejects a genuinely unexpected property', async () => {
        const badQuery = {...baseQuery, not_a_real_param: 'x'};

        await expect(pipe.transform(badQuery, {type: 'query', metatype: AuthorizeQueryDto})).rejects.toMatchObject({
            response: expect.objectContaining({message: expect.arrayContaining([expect.stringContaining('not_a_real_param')]) as unknown})
        });
    });
});
