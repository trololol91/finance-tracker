import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    BadRequestException, NotFoundException
} from '@nestjs/common';
import {ScraperAdminService} from '#scraper/scraper-admin.service.js';
import type {ConfigService} from '@nestjs/config';
import type {ScraperPluginLoader} from '#scraper/scraper.plugin-loader.js';
import type {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';

// Mock fs/promises operations used by installPlugin
vi.mock('fs/promises', () => ({
    mkdir: vi.fn(),
    rename: vi.fn(),
    rm: vi.fn()
}));

// Mock adm-zip — provide a minimal stub
vi.mock('adm-zip', () => ({
    default: vi.fn()
}));

// Mock the SDK validatePlugin so we control whether the plugin is valid
vi.mock('@finance-tracker/plugin-sdk/testing', () => ({
    validatePlugin: vi.fn()
}));

import {
    mkdir, rename, rm
} from 'fs/promises';
import AdmZip from 'adm-zip';
import {validatePlugin} from '@finance-tracker/plugin-sdk/testing';

describe('ScraperAdminService', () => {
    let service: ScraperAdminService;
    let mockConfig: {get: ReturnType<typeof vi.fn>};
    let mockLoader: {loadPlugins: ReturnType<typeof vi.fn>};
    let mockRegistry: {findByBankId: ReturnType<typeof vi.fn>};

    beforeEach(() => {
        vi.clearAllMocks();

        mockConfig   = {get: vi.fn()};
        mockLoader   = {loadPlugins: vi.fn().mockResolvedValue(undefined)};
        mockRegistry = {findByBankId: vi.fn()};

        service = new ScraperAdminService(
            mockConfig as unknown as ConfigService,
            mockLoader as unknown as ScraperPluginLoader,
            mockRegistry as unknown as ScraperRegistry
        );
    });

    // -----------------------------------------------------------------------
    // reloadPlugins
    // -----------------------------------------------------------------------

    describe('reloadPlugins', () => {
        it('should delegate to pluginLoader.loadPlugins()', async () => {
            await service.reloadPlugins();

            expect(mockLoader.loadPlugins).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // installPlugin
    // -----------------------------------------------------------------------

    describe('installPlugin', () => {
        // Shared setup for installPlugin tests: mocks fs ops, AdmZip, and the
        // two protected methods so no real processes or filesystem work happens.
        const setupInstallMocks = (fakePlugin: object, validates = true) => {
            vi.mocked(mkdir).mockResolvedValue(undefined);
            vi.mocked(rename).mockResolvedValue(undefined);
            vi.mocked(rm).mockResolvedValue(undefined);
            vi.mocked(AdmZip).mockImplementation(function () {
                return {
                    getEntries: vi.fn().mockReturnValue([]),
                    extractAllTo: vi.fn(),
                    readAsText: vi.fn().mockReturnValue('{}')
                };
            } as unknown as typeof AdmZip);
            vi.mocked(validatePlugin).mockReturnValue(validates);
            vi.spyOn(
                service as unknown as {importModule: () => Promise<unknown>},
                'importModule'
            ).mockResolvedValue({default: fakePlugin});
            return vi.spyOn(
                service as unknown as {runNpmInstall: (dir: string) => Promise<void>},
                'runNpmInstall'
            ).mockResolvedValue(undefined);
        };

        it('should throw BadRequestException when SCRAPER_PLUGIN_DIR is not set', async () => {
            mockConfig.get.mockReturnValue(undefined);

            await expect(
                service.installPlugin(Buffer.from(''))
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.installPlugin(Buffer.from(''))
            ).rejects.toThrow('SCRAPER_PLUGIN_DIR is not configured');
        });

        it('should extract zip, validate plugin, move to pluginDir/<bankId> and reload', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            setupInstallMocks({bankId: 'test-bank'});

            const result = await service.installPlugin(Buffer.from('fake-zip'));

            expect(result.bankId).toBe('test-bank');
            expect(result.pluginDir).toContain('test-bank');
            expect(mockLoader.loadPlugins).toHaveBeenCalledOnce();
        });

        it('should call npm install in the final plugin directory', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            const npmSpy = setupInstallMocks({bankId: 'my-bank'});

            await service.installPlugin(Buffer.from('fake-zip'));

            expect(npmSpy).toHaveBeenCalledOnce();
            expect(npmSpy).toHaveBeenCalledWith(expect.stringContaining('my-bank'));
        });

        it('should throw BadRequestException when plugin fails validation', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            setupInstallMocks({}, false);

            await expect(
                service.installPlugin(Buffer.from('fake-zip'))
            ).rejects.toThrow(BadRequestException);
        });
    });

    // -----------------------------------------------------------------------
    // testScraper
    // -----------------------------------------------------------------------

    describe('testScraper', () => {
        const makeMockPlugin = (overrides?: Partial<BankScraper>): BankScraper => ({
            bankId: 'cibc',
            displayName: 'CIBC',
            requiresMfaOnEveryRun: true,
            maxLookbackDays: 90,
            pendingTransactionsIncluded: true,
            login: vi.fn().mockResolvedValue(undefined),
            scrapeTransactions: vi.fn().mockResolvedValue([]),
            cleanup: vi.fn().mockResolvedValue(undefined),
            ...overrides
        } as unknown as BankScraper);

        it('should call plugin.login() and plugin.scrapeTransactions() with correct arguments', async () => {
            const plugin = makeMockPlugin();
            mockRegistry.findByBankId.mockReturnValue(plugin);

            const dto = {inputs: {username: 'u', password: 'p'}};
            await service.testScraper('cibc', dto);

            expect(plugin.login).toHaveBeenCalledWith(dto.inputs);
            expect(plugin.scrapeTransactions).toHaveBeenCalledWith(
                dto.inputs,
                {
                    startDate: expect.any(Date),
                    endDate: expect.any(Date),
                    includePending: true
                }
            );
        });

        it('should return { bankId, transactions, count } without DB write', async () => {
            const txn = {date: '2026-01-01', description: 'Test', amount: -10, pending: false, syntheticId: 'x'};
            const plugin = makeMockPlugin({
                scrapeTransactions: vi.fn().mockResolvedValue([txn])
            });
            mockRegistry.findByBankId.mockReturnValue(plugin);

            const result = await service.testScraper('cibc', {inputs: {}});

            expect(result).toEqual({bankId: 'cibc', transactions: [txn], count: 1});
        });

        it('should use plugin.maxLookbackDays when lookbackDays is not provided in dto', async () => {
            const plugin = makeMockPlugin({maxLookbackDays: 90});
            mockRegistry.findByBankId.mockReturnValue(plugin);

            const before = new Date();
            await service.testScraper('cibc', {inputs: {}});
            const after = new Date();

            const call = (plugin.scrapeTransactions as ReturnType<typeof vi.fn>).mock.calls[0][1];
            const windowMs = call.endDate.getTime() - call.startDate.getTime();
            const windowDays = windowMs / (24 * 60 * 60 * 1000);

            expect(windowDays).toBeGreaterThanOrEqual(89);
            expect(windowDays).toBeLessThanOrEqual(91);
            expect(call.endDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(call.endDate.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('should use dto.lookbackDays when provided', async () => {
            const plugin = makeMockPlugin({maxLookbackDays: 90});
            mockRegistry.findByBankId.mockReturnValue(plugin);

            await service.testScraper('cibc', {inputs: {}, lookbackDays: 7});

            const call = (plugin.scrapeTransactions as ReturnType<typeof vi.fn>).mock.calls[0][1];
            const windowMs = call.endDate.getTime() - call.startDate.getTime();
            const windowDays = windowMs / (24 * 60 * 60 * 1000);

            expect(windowDays).toBeGreaterThanOrEqual(6);
            expect(windowDays).toBeLessThanOrEqual(8);
        });

        it('should throw NotFoundException when bankId is not in the registry', async () => {
            mockRegistry.findByBankId.mockReturnValue(undefined);

            await expect(
                service.testScraper('unknown', {inputs: {}})
            ).rejects.toThrow(NotFoundException);
        });

        it('should propagate the error when login() throws', async () => {
            const plugin = makeMockPlugin({
                login: vi.fn().mockRejectedValue(new Error('Login failed'))
            });
            mockRegistry.findByBankId.mockReturnValue(plugin);

            await expect(
                service.testScraper('cibc', {inputs: {username: 'u', password: 'p'}})
            ).rejects.toThrow('Login failed');
        });

        it('should propagate the error when scrapeTransactions() throws', async () => {
            const plugin = makeMockPlugin({
                scrapeTransactions: vi.fn().mockRejectedValue(new Error('Scrape failed'))
            });
            mockRegistry.findByBankId.mockReturnValue(plugin);

            await expect(
                service.testScraper('cibc', {inputs: {username: 'u', password: 'p'}})
            ).rejects.toThrow('Scrape failed');
        });

        it('should call cleanup() after a successful scrape', async () => {
            const plugin = makeMockPlugin();
            mockRegistry.findByBankId.mockReturnValue(plugin);

            await service.testScraper('cibc', {inputs: {}});

            expect(plugin.cleanup).toHaveBeenCalledOnce();
        });

        it('should call cleanup() even when login() throws', async () => {
            const plugin = makeMockPlugin({
                login: vi.fn().mockRejectedValue(new Error('Login failed'))
            });
            mockRegistry.findByBankId.mockReturnValue(plugin);

            await expect(service.testScraper('cibc', {inputs: {}})).rejects.toThrow('Login failed');

            expect(plugin.cleanup).toHaveBeenCalledOnce();
        });

        it('should call cleanup() even when scrapeTransactions() throws', async () => {
            const plugin = makeMockPlugin({
                scrapeTransactions: vi.fn().mockRejectedValue(new Error('Scrape failed'))
            });
            mockRegistry.findByBankId.mockReturnValue(plugin);

            await expect(service.testScraper('cibc', {inputs: {}})).rejects.toThrow('Scrape failed');

            expect(plugin.cleanup).toHaveBeenCalledOnce();
        });

        it('should not throw when plugin has no cleanup() method', async () => {
            const plugin = makeMockPlugin({cleanup: undefined});
            mockRegistry.findByBankId.mockReturnValue(plugin);

            await expect(service.testScraper('cibc', {inputs: {}})).resolves.toBeDefined();
        });
    });
});
