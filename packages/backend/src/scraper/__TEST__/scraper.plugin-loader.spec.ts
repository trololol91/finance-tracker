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
// fs/promises mocks — vi.mock hoists to the top of the file
// ---------------------------------------------------------------------------

vi.mock('fs/promises', () => ({
    readdir: vi.fn(),
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT'))
}));

import {
    readdir, readFile
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

/** Construct a minimal Dirent-like stub for readdir withFileTypes results. */
const makeDirent = (name: string, isDir = false): Dirent =>
    ({isFile: () => !isDir, isDirectory: () => isDir, name} as unknown as Dirent);

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
        it('should call loadPlugins()', async () => {
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

        it('should ignore file entries in the plugin directory', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([
                makeDirent('readme.md'),
                makeDirent('plugin.ts'),
                makeDirent('image.png')
            ]);

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should only process directory entries', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([
                makeDirent('loose-file.js') // isDirectory() returns false
            ]);

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        // -----------------------------------------------------------------------
        // Happy path — valid plugin
        // -----------------------------------------------------------------------

        it('should register a valid plugin from a subdirectory', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('cibc', true)]);

            const plugin = makePlugin('cibc');
            const loadModuleSpy = spyLoadModule(loader);
            loadModuleSpy.mockResolvedValue({default: plugin});

            await loader.loadPlugins();

            expect(mockRegistry.register).toHaveBeenCalledOnce();
            expect(mockRegistry.register).toHaveBeenCalledWith(
                plugin,
                expect.stringMatching(/^file:\/\//)
            );
            expect(loadModuleSpy).toHaveBeenCalledWith(
                expect.stringMatching(/cibc[/\\]index\.js$/)
            );
        });

        it('should register all valid plugins when multiple subdirectories are present', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([
                makeDirent('cibc', true),
                makeDirent('rbc', true)
            ]);

            const cibc = makePlugin('cibc');
            const rbc = makePlugin('rbc');
            const loadModuleSpy = spyLoadModule(loader);
            loadModuleSpy.mockResolvedValueOnce({default: cibc});
            loadModuleSpy.mockResolvedValueOnce({default: rbc});

            await loader.loadPlugins();

            expect(mockRegistry.register).toHaveBeenCalledTimes(2);
            expect(mockRegistry.register).toHaveBeenCalledWith(
                cibc,
                expect.stringMatching(/^file:\/\//)
            );
            expect(mockRegistry.register).toHaveBeenCalledWith(
                rbc,
                expect.stringMatching(/^file:\/\//)
            );
            expect(loadModuleSpy).toHaveBeenNthCalledWith(
                1, expect.stringMatching(/cibc[/\\]index\.js$/)
            );
            expect(loadModuleSpy).toHaveBeenNthCalledWith(
                2, expect.stringMatching(/rbc[/\\]index\.js$/)
            );
        });

        it('should use package.json main field as entry point when present', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('myplugin', true)]);
            vi.mocked(readFile).mockResolvedValueOnce(
                JSON.stringify({main: 'dist/index.js'}) as unknown as Buffer
            );

            const plugin = makePlugin('myplugin');
            const loadModuleSpy = spyLoadModule(loader);
            loadModuleSpy.mockResolvedValue({default: plugin});

            await loader.loadPlugins();

            expect(loadModuleSpy).toHaveBeenCalledWith(
                expect.stringMatching(/myplugin[/\\]dist[/\\]index\.js$/)
            );
        });

        // -----------------------------------------------------------------------
        // Invalid default export — skip but continue
        // -----------------------------------------------------------------------

        it('should skip a plugin whose default export is missing', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad', true)]);

            spyLoadModule(loader).mockResolvedValue({}); // no default key

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should skip a plugin whose default export is missing required fields', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad', true)]);

            spyLoadModule(loader).mockResolvedValue({
                default: {bankId: 'rbc'} // missing displayName, login, etc.
            });

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should skip a plugin whose default export is missing inputSchema', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad', true)]);

            // All required fields present EXCEPT inputSchema
            const {inputSchema: _omitted, ...withoutInputSchema} = makePlugin('rbc');
            spyLoadModule(loader).mockResolvedValue({default: withoutInputSchema});

            await loader.loadPlugins();

            expect(mockRegistry.register).not.toHaveBeenCalled();
        });

        it('should skip a plugin whose inputSchema is not an array', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('bad', true)]);

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
                makeDirent('broken', true),
                makeDirent('good', true)
            ]);

            const good = makePlugin('good-bank');
            const loadModuleSpy = spyLoadModule(loader);
            loadModuleSpy.mockRejectedValueOnce(new Error('Syntax error'));
            loadModuleSpy.mockResolvedValueOnce({default: good});

            await loader.loadPlugins();

            // Only the good plugin should be registered
            expect(mockRegistry.register).toHaveBeenCalledOnce();
            expect(mockRegistry.register).toHaveBeenCalledWith(
                good,
                expect.stringMatching(/^file:\/\//)
            );
            expect(loadModuleSpy).toHaveBeenNthCalledWith(
                1, expect.stringMatching(/broken[/\\]index\.js$/)
            );
            expect(loadModuleSpy).toHaveBeenNthCalledWith(
                2, expect.stringMatching(/good[/\\]index\.js$/)
            );
        });
    });

    // TC-PL-02
    describe('loadPlugins — file:// URL second arg', () => {
        it('should call registry.register with the plugin file URL as second argument', async () => {
            mockConfig.get.mockReturnValue('/plugins');
            vi.mocked(readdir).mockResolvedValue([makeDirent('cibc', true)]);
            const plugin = makePlugin('cibc');
            spyLoadModule(loader).mockResolvedValue({default: plugin});

            await loader.loadPlugins();

            expect(mockRegistry.register).toHaveBeenCalledWith(
                plugin,
                expect.stringMatching(/^file:\/\//)
            );
        });
    });
});
