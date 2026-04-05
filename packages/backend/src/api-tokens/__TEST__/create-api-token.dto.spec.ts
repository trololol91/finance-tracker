import {
    describe, it, expect
} from 'vitest';
import {validate} from 'class-validator';
import {CreateApiTokenDto} from '#api-tokens/dto/create-api-token.dto.js';

const validDto = (): CreateApiTokenDto => {
    const dto = new CreateApiTokenDto();
    dto.name = 'My Token';
    dto.scopes = ['transactions:read'];
    return dto;
};

describe('CreateApiTokenDto', () => {
    it('passes with valid name and scopes', async () => {
        const errors = await validate(validDto());
        expect(errors).toHaveLength(0);
    });

    it('fails when name is empty', async () => {
        const dto = validDto();
        dto.name = '';
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('fails when name exceeds 100 characters', async () => {
        const dto = validDto();
        dto.name = 'a'.repeat(101);
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('fails when scopes array is empty', async () => {
        const dto = validDto();
        dto.scopes = [] as never;
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'scopes')).toBe(true);
    });

    it('fails when scopes contains an invalid value', async () => {
        const dto = validDto();
        dto.scopes = ['invalid:scope'] as never;
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'scopes')).toBe(true);
    });

    it('passes without expiresAt', async () => {
        const errors = await validate(validDto());
        expect(errors).toHaveLength(0);
    });

    it('passes with a future expiresAt', async () => {
        const dto = validDto();
        // Use +2 days as a conservative buffer — see the "tomorrow boundary" test for exact edge.
        dto.expiresAt = new Date(Date.now() + 172800000).toISOString().split('T')[0];
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
    });

    it('passes when expiresAt is exactly tomorrow UTC (the minimum valid value)', async () => {
        const dto = validDto();
        const now = new Date();
        dto.expiresAt = new Date(Date.UTC(
            now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
        )).toISOString().split('T')[0];
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
    });

    it('fails when expiresAt is today (must be tomorrow or later)', async () => {
        const dto = validDto();
        // Use Date.UTC to derive today's date in UTC, matching the validator's own logic.
        const now = new Date();
        dto.expiresAt = new Date(Date.UTC(
            now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
        )).toISOString().split('T')[0];
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'expiresAt')).toBe(true);
    });

    it('fails when expiresAt is in the past', async () => {
        const dto = validDto();
        dto.expiresAt = '2020-01-01';
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'expiresAt')).toBe(true);
    });

    it('fails when expiresAt is not a valid date string', async () => {
        const dto = validDto();
        dto.expiresAt = 'not-a-date';
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'expiresAt')).toBe(true);
    });
});
