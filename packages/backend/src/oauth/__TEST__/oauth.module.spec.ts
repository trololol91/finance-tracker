import {
    describe, it, expect, vi
} from 'vitest';
import type {ConfigService} from '@nestjs/config';
import {OAuthModule} from '#oauth/oauth.module.js';
import type {OAuthClientsService} from '#oauth/oauth-clients.service.js';

describe('OAuthModule.onModuleInit', () => {
    it('does not throw when the static-client upsert fails — a boot-time DB hiccup must not take down the whole app', async () => {
        const oauthClientsService = {
            ensureStaticClient: vi.fn().mockRejectedValue(new Error('connection refused'))
        } as unknown as OAuthClientsService;
        const config = {
            get: vi.fn()
                .mockReturnValueOnce('claude-ai')
                .mockReturnValueOnce('https://claude.ai/callback')
        } as unknown as ConfigService;
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const module = new OAuthModule(oauthClientsService, config);

        await expect(module.onModuleInit()).resolves.toBeUndefined();
        expect(oauthClientsService.ensureStaticClient).toHaveBeenCalledWith('claude-ai', ['https://claude.ai/callback']);

        errorSpy.mockRestore();
    });

    it('skips ensureStaticClient entirely when the env vars are unset', async () => {
        const oauthClientsService = {
            ensureStaticClient: vi.fn()
        } as unknown as OAuthClientsService;
        const config = {get: vi.fn().mockReturnValue(undefined)} as unknown as ConfigService;

        const module = new OAuthModule(oauthClientsService, config);
        await module.onModuleInit();

        expect(oauthClientsService.ensureStaticClient).not.toHaveBeenCalled();
    });
});
