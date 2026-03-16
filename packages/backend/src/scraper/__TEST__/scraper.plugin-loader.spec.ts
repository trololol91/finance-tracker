import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {ScraperPluginLoader} from '#scraper/scraper.plugin-loader.js';
import type {ConfigService} from '@nestjs/config';
import type {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';
import type {Dirent} from 'fs';

// ---------------------------------------------------------------------------
// fs and fs/promises mocks — vi.mock hoists to the top of the file
// ---------------------------------------------------------------------------

vi.mock('fs', () => ({constants: {F_OK: 0}}));

vi.mock('fs/promises', () => ({
    readdir: vi.fn(),
    copyFile: vi.fn(),
    access: vi.fn()
}));

import {
    readdir, copyFile, access
} from 'fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePlugin = (bankId = 'test-bank'): BankScraper => ({
    bankId,
    displayName: `${bankId} Bank`,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    inputSchema: [],
    login: vi.fn(),
    scrapeTransactions: vi.fn()
});

/** Construct a minimal Dirent-like stub that passes the readdir withFileTypes filter. */
const makeDirent = (name: string, isFile = true): Dirent =>
    ({isFile: () => isFile, name} as unknown as Dirent);

/** Returns a vi.spyOn targeting the protected `loadModule` method of ScraperPluginLoader. */
const spyLoadModule = (l: ScraperPluginLoader) =>
    vi.spyOn(
        l as unknown as {loadModule: (href: string) => Promise<Record<string, unknown>>},
        'loadModule'
    );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScraperPluginLoader', () => {
    let loader: ScraperPluginLoader;
    let mockConfig: {get: ReturnType<typeof vi.fn>};
    let mockRegistry: {register: ReturnType<typeof vi.fn>};

    beforeEach(() => {
        vi.clearAllMocks();

        mockConfig = {get: vi.fn()};
        mockRegistry = {register: vi.fn()};

        loader = new ScraperPluginLoader(
            mockConfig as unknown as ConfigService,
            mockRegistry as unknown as ScraperRegistry
        );
    });

    // -----------------------------------------------------------------------
    // onModuleInit
    // -----------------------------------------------------------------------

    describe('onModuleInit', () => {
        it('should call seedBuiltins() before loadPlugins()', async () => {
            const callOrder: string[] = [];
            vi.spyOn(loader as unknown as {seedBuiltins: () => Promise<void>}, 'seedBuiltins')
                .mockImplementation(() => { callOrder.push('seedBuiltins'); return Promise.resolve(); });
            vi.spyOn(loader, 'loadPlugins')
                .mockImplementation(() => { callOrder.push('loadPlugins'); return Promise.resolve(); });

            await loader.onModuleInit();

            expect(callOrder).toEqual(['seedBuiltins', 'loadPlugins']);
        });

        it('should call loadPlugins()', async () => {
            vi.spyOn(loader as unknown as {seedBuiltins: () => Promise<void>}, 'seedBuiltins')
                .mockResolvedValue(undefined);
            const loadPluginsSpy = vi.spyOn(loader, 'loadPlugins').mockResolvedValue(undefined);

            await loader.onModuleInit();

            expect(loadPluginsSpy).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // loadPlugins — env var guard
    // -----------------------------------------------------------------------

    describe('loadPlugins', () => {
        it('should return early without scanning when SCRAPER_PLUGIN_DIR is not set', async () => {
            mockConfig.get.mockReturnValue(undefined);

            await loader.loadPlugins();

            expect(vi.mocked(readdir)).not.toHaveBeenCalled();
            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should return early when SCRAPER_PLUGIN_DIR is an empty string', async () => {
            mockConfig.get.mockReturnValue('');

            await loader.loadPlugins();

            expect(vi.mocked(readdir)).not.toHaveBeenCalled();
            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        // -----------------------------------------------------------------------
        // Filesystem errors
        // -----------------------------------------------------------------------

        it('should re-throw when readdir fails', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'));

            await expect(loader.loadPlugins()).rejects.toThrow('ENOENT');
        });

        it('should not register anything when directory is empty', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([]);

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should ignore non-.js files in the plugin directory', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([
                makeDirent('readme.md'),
                makeDirent('plugin.ts'),
                makeDirent('image.png')
            ]);

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should ignore directory entries that are not files', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([
                makeDirent('subdir', false) // isFile() returns false
            ]);

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        // -----------------------------------------------------------------------
        // Happy path — valid plugin
        // -----------------------------------------------------------------------

        it('should register a valid plugin from a .js file', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('cibc.js')]);

            const plugin = makePlugin('cibc');
            const loadModuleSpy = spyLoadModule(loader);
            loadModuleSpy.mockResolvedValue({default: plugin});

            await loader.loadPlugins();

            expect(mockRegistry.register).toHaveBeenCalledOnce();
            expect(mockRegistry.register).toHaveBeenCalledWith(plugin);
            expect(loadModuleSpy).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\//));
        });

        it('should register all valid plugins when multiple files are present', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([
                makeDirent('cibc.js'),
                makeDirent('rbc.js')
            ]);

            const cibc = makePlugin('cibc');
            const rbc = makePlugin('rbc');
            const loadModuleSpy = spyLoadModule(loader);
            loadModuleSpy.mockResolvedValueOnce({default: cibc});
            loadModuleSpy.mockResolvedValueOnce({default: rbc});

            await loader.loadPlugins();

            expect(mockRegistry.register).toHaveBeenCalledTimes(2);
            expect(mockRegistry.register).toHaveBeenCalledWith(cibc);
            expect(mockRegistry.register).toHaveBeenCalledWith(rbc);
            expect(loadModuleSpy).toHaveBeenNthCalledWith(1, expect.stringMatching(/^file:\/\//));
            expect(loadModuleSpy).toHaveBeenNthCalledWith(2, expect.stringMatching(/^file:\/\//));
        });

        // -----------------------------------------------------------------------
        // Invalid default export — skip but continue
        // -----------------------------------------------------------------------

        it('should skip a plugin whose default export is missing', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad.js')]);

            spyLoadModule(loader).mockResolvedValue({}); // no default key

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should skip a plugin whose default export is missing required fields', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad.js')]);

            spyLoadModule(loader).mockResolvedValue({
                default: {bankId: 'rbc'} // missing displayName, login, etc.
            });

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should skip a plugin whose default export is missing inputSchema', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad.js')]);

            // All required fields present EXCEPT inputSchema
            const {inputSchema: _omitted, ...withoutInputSchema} = makePlugin('rbc');
            spyLoadModule(loader).mockResolvedValue({default: withoutInputSchema});

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should skip a plugin whose inputSchema is not an array', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad.js')]);

            spyLoadModule(loader).mockResolvedValue({
                default: {
                    ...makePlugin('rbc'),
                    inputSchema: 'not-an-array'
                }
            });

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        // -----------------------------------------------------------------------
        // Import throws — skip but continue
        // -----------------------------------------------------------------------

        it('should skip a plugin that throws during import and continue with the next', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([
                makeDirent('broken.js'),
                makeDirent('good.js')
            ]);

            const good = makePlugin('good-bank');
            const loadModuleSpy = spyLoadModule(loader);
            loadModuleSpy.mockRejectedValueOnce(new Error('Syntax error'));
            loadModuleSpy.mockResolvedValueOnce({default: good});

            await loader.loadPlugins();

            // Only the good plugin should be registered
            expect(mockRegistry.register).toHaveBeenCalledOnce();
            expect(mockRegistry.register).toHaveBeenCalledWith(good);
            expect(loadModuleSpy).toHaveBeenNthCalledWith(1, expect.stringMatching(/^file:\/\//));
            expect(loadModuleSpy).toHaveBeenNthCalledWith(2, expect.stringMatching(/^file:\/\//));
        });
    });

    // -----------------------------------------------------------------------
    // seedBuiltins
    // -----------------------------------------------------------------------

    describe('seedBuiltins', () => {
        // Helper to call the private method directly
        const callSeedBuiltins = (l: ScraperPluginLoader) =>
            (l as unknown as {seedBuiltins: () => Promise<void>}).seedBuiltins();

        it('should return early without copying when SCRAPER_PLUGIN_DIR is not set', async () => {
            mockConfig.get.mockReturnValue(undefined);

            await callSeedBuiltins(loader);

            expect(vi.mocked(access)).not.toHaveBeenCalled();
            expect(vi.mocked(copyFile)).not.toHaveBeenCalled();
        });

        it('should skip copying a built-in plugin when it already exists in the plugin dir', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(access).mockResolvedValue(undefined);

            await callSeedBuiltins(loader);

            expect(vi.mocked(copyFile)).not.toHaveBeenCalled();
        });

        it('should log a skip message when the built-in plugin is already present', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(access).mockResolvedValue(undefined);
            const logSpy = vi.spyOn((loader as unknown as {logger: {log: () => void}}).logger, 'log');

            await callSeedBuiltins(loader);

            expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/skip/i));
        });

        it('should copy a built-in plugin when it is not present in the plugin dir', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            const enoent = Object.assign(new Error('ENOENT'), {code: 'ENOENT'});
            vi.mocked(access).mockRejectedValue(enoent);
            vi.mocked(copyFile).mockResolvedValue(undefined);

            await callSeedBuiltins(loader);

            expect(vi.mocked(copyFile)).toHaveBeenCalledWith(
                expect.stringContaining('cibc.scraper.js'),
                expect.stringContaining('plugins')
            );
        });

        it('should copy all built-in plugins on a clean install', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            const enoent = Object.assign(new Error('ENOENT'), {code: 'ENOENT'});
            vi.mocked(access).mockRejectedValue(enoent);
            vi.mocked(copyFile).mockResolvedValue(undefined);

            await callSeedBuiltins(loader);

            expect(vi.mocked(copyFile)).toHaveBeenCalledTimes(2);
        });

        it('should not overwrite a plugin that already exists (idempotent)', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            const enoent = Object.assign(new Error('ENOENT'), {code: 'ENOENT'});
            // First file exists, second is missing
            vi.mocked(access)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(enoent);
            vi.mocked(copyFile).mockResolvedValue(undefined);

            await callSeedBuiltins(loader);

            expect(vi.mocked(copyFile)).toHaveBeenCalledTimes(1);
        });

        it('should re-throw when access() fails with a non-ENOENT error', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            const permErr = Object.assign(new Error('EACCES'), {code: 'EACCES'});
            vi.mocked(access).mockRejectedValue(permErr);

            await expect(callSeedBuiltins(loader)).rejects.toThrow('EACCES');
            expect(vi.mocked(copyFile)).not.toHaveBeenCalled();
        });

        it('should resolve built-in plugin paths relative to the loader module (contains "banks")', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            const enoent = Object.assign(new Error('ENOENT'), {code: 'ENOENT'});
            vi.mocked(access).mockRejectedValue(enoent);
            vi.mocked(copyFile).mockResolvedValue(undefined);

            await callSeedBuiltins(loader);

            const [firstSrcArg] = vi.mocked(copyFile).mock.calls[0];
            expect(firstSrcArg).toContain('banks');
            expect(firstSrcArg).toMatch(/cibc\.scraper\.js$/);
        });
    });
});
