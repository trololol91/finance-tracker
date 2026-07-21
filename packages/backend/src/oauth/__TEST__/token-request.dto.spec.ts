import {
    describe, it, expect
} from 'vitest';
import {ValidationPipe} from '@nestjs/common';
import {TokenRequestDto} from '#oauth/dto/token-request.dto.js';

// Matches main.ts's global pipe exactly — see authorize-query.dto.spec.ts
// for why this can't be proven via a plain class-validator `validate()` call.
const pipe = new ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true});

const baseBody = {
    grant_type: 'authorization_code',
    code: 'oac_rawcode',
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    client_id: 'claude-ai',
    code_verifier: 'a'.repeat(43)
};

describe('TokenRequestDto (real ValidationPipe)', () => {
    it('accepts a real Claude /token request carrying resource (RFC 8707 §2 echo requirement)', async () => {
        const claudeBody = {...baseBody, resource: 'https://finance.riol.ca/mcp'};

        await expect(pipe.transform(claudeBody, {type: 'body', metatype: TokenRequestDto})).resolves.toBeInstanceOf(TokenRequestDto);
    });
});
