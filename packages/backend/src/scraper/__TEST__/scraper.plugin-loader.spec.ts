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
// fs/promises mock — vi.mock hoists to the top of the file before any import
// ---------------------------------------------------------------------------

vi.mock('fs/promises', () => ({
    readdir: vi.fn()
}));

import {readdir} from 'fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePlugin = (bankId = 'test-bank'): BankScraper => ({
    bankId,
    displayName: `${bankId} Bank`,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    login: vi.fn(),
    scrapeTransactions: vi.fn()
});

/** Construct a minimal Dirent-like stub that passes the readdir withFileTypes filter. */
const makeDirent = (name: string, isFile = true): Dirent =>
    ({isFile: () => isFile, name} as unknown as Dirent);

/** Returns a vi.spyOn targeting the protected `loadModule` method of ScraperPluginLoader. */
const spyLoadModule = (
    l: ScraperPluginLoader
): ReturnType<typeof vi.spyOn> =>
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
            vi.spyOn(loader, 'loadPlugins').mockResolvedValue(undefined);

            await loader.onModuleInit();

            expect(loader.loadPlugins).toHaveBeenCalledOnce();
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
        });
    });
});
