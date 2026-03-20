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

vi.mock('fs/promises', () => ({
    writeFile: vi.fn()
}));

import {writeFile} from 'fs/promises';

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
    // sanitiseFilename
    // -----------------------------------------------------------------------

    describe('sanitiseFilename', () => {
        it('should return the basename for a safe filename', () => {
            expect(service.sanitiseFilename('cibc-plugin.js')).toBe('cibc-plugin.js');
        });

        it('should strip directory prefix from filename', () => {
            expect(service.sanitiseFilename('/etc/passwd/../cibc.js')).toBe('cibc.js');
        });

        it('should throw BadRequestException for an empty basename after stripping', () => {
            expect(() => service.sanitiseFilename('/')).toThrow(BadRequestException);
            expect(() => service.sanitiseFilename('/')).toThrow('must not be empty');
        });

        it('should throw BadRequestException for a non-js file', () => {
            expect(() => service.sanitiseFilename('plugin.ts')).toThrow(BadRequestException);
            expect(() => service.sanitiseFilename('plugin.ts')).toThrow('Only .js plugin files');
        });

        it('should normalise an uppercase extension to lowercase', () => {
            expect(service.sanitiseFilename('CIBC.JS')).toBe('cibc.js');
        });

        it('should throw BadRequestException for a filename with invalid characters', () => {
            expect(() => service.sanitiseFilename('bad file!.js')).toThrow(BadRequestException);
            expect(() => service.sanitiseFilename('bad file!.js')).toThrow('Invalid plugin filename');
        });

        it('should throw BadRequestException for a leading-dot filename', () => {
            expect(() => service.sanitiseFilename('.hidden.js')).toThrow(BadRequestException);
            expect(() => service.sanitiseFilename('.hidden.js')).toThrow('Invalid plugin filename');
        });

        it('should throw BadRequestException for a double-dot filename', () => {
            expect(() => service.sanitiseFilename('..cibc.js')).toThrow(BadRequestException);
            expect(() => service.sanitiseFilename('..cibc.js')).toThrow('Invalid plugin filename');
        });

        it('should allow filenames with hyphens, dots, and digits', () => {
            expect(service.sanitiseFilename('my-bank-v2.1.js')).toBe('my-bank-v2.1.js');
        });
    });

    // -----------------------------------------------------------------------
    // installPlugin
    // -----------------------------------------------------------------------

    describe('installPlugin', () => {
        it('should throw BadRequestException when SCRAPER_PLUGIN_DIR is not set', async () => {
            mockConfig.get.mockReturnValue(undefined);

            await expect(
                service.installPlugin('plugin.js', Buffer.from(''))
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.installPlugin('plugin.js', Buffer.from(''))
            ).rejects.toThrow('SCRAPER_PLUGIN_DIR is not configured');
        });

        it('should write the file to SCRAPER_PLUGIN_DIR and call loadPlugins', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(writeFile).mockResolvedValue(undefined);
            const buf = Buffer.from('export default {}');

            const filename = await service.installPlugin('cibc.js', buf);

            expect(vi.mocked(writeFile)).toHaveBeenCalledOnce();
            expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
                expect.stringContaining('cibc.js'),
                buf
            );
            expect(mockLoader.loadPlugins).toHaveBeenCalledOnce();
            expect(filename).toBe('cibc.js');
        });

        it('should sanitise the filename before writing', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(writeFile).mockResolvedValue(undefined);

            const filename = await service.installPlugin('/malicious/../cibc.js', Buffer.from(''));

            expect(filename).toBe('cibc.js');
            expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
                expect.stringContaining('cibc.js'),
                expect.anything()
            );
        });

        it('should throw BadRequestException for an invalid filename without writing', async () => {
            mockConfig.get.mockReturnValue('/plugins');

            await expect(
                service.installPlugin('bad file!.js', Buffer.from(''))
            ).rejects.toThrow(BadRequestException);
            expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
        });

        it('should re-throw when writeFile fails', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(writeFile).mockRejectedValue(new Error('EACCES'));

            await expect(
                service.installPlugin('cibc.js', Buffer.from(''))
            ).rejects.toThrow('EACCES');
            expect(mockLoader.loadPlugins).not.toHaveBeenCalled();
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
    });
});
