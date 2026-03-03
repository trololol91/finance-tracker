import {
    describe, it, expect, beforeEach
} from 'vitest';
import {InternalServerErrorException} from '@nestjs/common';
import {CryptoService} from '#scraper/crypto/crypto.service.js';
import type {ConfigService} from '@nestjs/config';

// 64-character hex string (32 bytes) — used for tests only
const VALID_KEY = 'a'.repeat(64);
const DIFFERENT_KEY = 'b'.repeat(64);

const makeConfigService = (key: string | undefined): ConfigService =>
    ({get: () => key}) as unknown as ConfigService;

describe('CryptoService', () => {
    let service: CryptoService;

    beforeEach(() => {
        service = new CryptoService(makeConfigService(VALID_KEY));
    });

    // -------------------------------------------------------------------------
    // Initialisation guards
    // -------------------------------------------------------------------------

    describe('constructor', () => {
        it('should construct successfully with a valid 64-char hex key', () => {
            expect(() => new CryptoService(makeConfigService(VALID_KEY))).not.toThrow();
        });

        it('should throw InternalServerErrorException when key is missing', () => {
            expect(() => new CryptoService(makeConfigService(undefined))).toThrow(
                InternalServerErrorException
            );
        });

        it('should throw InternalServerErrorException when key is too short', () => {
            expect(() => new CryptoService(makeConfigService('a'.repeat(32)))).toThrow(
                InternalServerErrorException
            );
        });

        it('should throw InternalServerErrorException when key is too long', () => {
            expect(() => new CryptoService(makeConfigService('a'.repeat(65)))).toThrow(
                InternalServerErrorException
            );
        });
    });

    // -------------------------------------------------------------------------
    // Round-trip correctness
    // -------------------------------------------------------------------------

    describe('encrypt / decrypt', () => {
        it('should decrypt to the original plaintext (simple string)', () => {
            const plaintext = 'hello world';
            const encrypted = service.encrypt(plaintext);
            expect(service.decrypt(encrypted)).toBe(plaintext);
        });

        it('should decrypt to the original plaintext (JSON credentials)', () => {
            const creds = JSON.stringify({username: 'user@bank.com', password: 'S3cr3t!'});
            expect(service.decrypt(service.encrypt(creds))).toBe(creds);
        });

        it('should produce different ciphertext on each call (random IV)', () => {
            const plaintext = 'same input';
            const enc1 = service.encrypt(plaintext);
            const enc2 = service.encrypt(plaintext);
            expect(enc1).not.toBe(enc2);
        });

        it('should produce a blob in iv:ciphertext:tag format', () => {
            const blob = service.encrypt('test');
            const parts = blob.split(':');
            expect(parts).toHaveLength(3);
            // IV = 12 bytes = 24 hex chars
            expect(parts[0]).toHaveLength(24);
            // tag = 16 bytes = 32 hex chars
            expect(parts[2]).toHaveLength(32);
        });
    });

    // -------------------------------------------------------------------------
    // Error cases
    // -------------------------------------------------------------------------

    describe('decrypt errors', () => {
        it('should throw InternalServerErrorException for a malformed blob', () => {
            expect(() => service.decrypt('not-a-valid-blob')).toThrow(
                InternalServerErrorException
            );
        });

        it('should throw InternalServerErrorException for a blob with wrong number of parts', () => {
            expect(() => service.decrypt('aa:bb')).toThrow(InternalServerErrorException);
        });

        it('should throw InternalServerErrorException when decrypting with a different key', () => {
            const otherService = new CryptoService(makeConfigService(DIFFERENT_KEY));
            const encrypted = service.encrypt('secret data');
            expect(() => otherService.decrypt(encrypted)).toThrow(InternalServerErrorException);
        });

        it('should throw InternalServerErrorException when the ciphertext is tampered', () => {
            const blob = service.encrypt('secret data');
            const parts = blob.split(':');
            // Flip last char of ciphertext to corrupt it
            parts[1] = parts[1].slice(0, -1) + (parts[1].endsWith('a') ? 'b' : 'a');
            expect(() => service.decrypt(parts.join(':'))).toThrow(InternalServerErrorException);
        });
    });
});
