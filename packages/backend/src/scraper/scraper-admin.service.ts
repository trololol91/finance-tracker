import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {
    mkdir, rename, rm
} from 'fs/promises';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {
    join, resolve, sep
} from 'path';
import {pathToFileURL} from 'url';
import {tmpdir} from 'os';
import {randomUUID} from 'crypto';
import AdmZip from 'adm-zip';
import {ScraperPluginLoader} from '#scraper/scraper.plugin-loader.js';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {RawTransaction} from '#scraper/interfaces/bank-scraper.interface.js';
import {TestScraperDto} from '#scraper/admin/dto/test-scraper.dto.js';
import {TestScraperResponseDto} from '#scraper/admin/dto/test-scraper-response.dto.js';
import {validatePlugin} from '@finance-tracker/plugin-sdk/testing';

const execFileAsync = promisify(execFile);

/**
 * ScraperAdminService provides the business logic for the admin plugin
 * management endpoints.
 *
 * - reloadPlugins(): re-scans SCRAPER_PLUGIN_DIR and registers any plugins
 *   found, picking up files added since the last load without restarting.
 * - installPlugin(): extracts a .zip plugin package to SCRAPER_PLUGIN_DIR/<bankId>/,
 *   validates the default export, and reloads plugins so the new scraper is active.
 */
@Injectable()
export class ScraperAdminService {
    private readonly logger = new Logger(ScraperAdminService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly pluginLoader: ScraperPluginLoader,
        private readonly registry: ScraperRegistry
    ) {}

    /**
     * Re-scan SCRAPER_PLUGIN_DIR and register any plugins found.
     * Delegates directly to ScraperPluginLoader.loadPlugins().
     */
    public async reloadPlugins(): Promise<void> {
        this.logger.log('Admin triggered plugin reload');
        await this.pluginLoader.loadPlugins();
    }

    /**
     * Extract a .zip plugin package to SCRAPER_PLUGIN_DIR/<bankId>/ and reload.
     *
     * Steps:
     *  1. Extract zip to a temp directory, guarding against path traversal.
     *  2. Dynamically import the entry point and validate the default export.
     *  3. Move the temp directory to SCRAPER_PLUGIN_DIR/<bankId>/.
     *  4. Reload all plugins so the new scraper is immediately active.
     *
     * @param buffer - Raw zip bytes from the multipart upload.
     * @returns {bankId, pluginDir} — the resolved bankId and final install path.
     * @throws BadRequestException on config, zip, or validation errors.
     */
    public async installPlugin(buffer: Buffer): Promise<{bankId: string, pluginDir: string}> {
        const pluginDir = this.config.get<string>('SCRAPER_PLUGIN_DIR');
        if (!pluginDir) {
            throw new BadRequestException(
                'SCRAPER_PLUGIN_DIR is not configured — plugin installation is disabled'
            );
        }

        // 1. Extract zip to a unique temp directory
        const tempDir = join(tmpdir(), `finance-plugin-${randomUUID()}`);
        await mkdir(tempDir, {recursive: true});

        try {
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();

            // Hoist resolved temp path — used in every loop iteration
            const resolvedTempDir = resolve(tempDir);
            for (const entry of entries) {
                // Guard against path traversal (e.g. ../../etc/passwd)
                const entryDest = resolve(tempDir, entry.entryName);
                if (
                    !entryDest.startsWith(resolvedTempDir + sep) &&
                    entryDest !== resolvedTempDir
                ) {
                    throw new BadRequestException(
                        `Unsafe zip entry rejected: '${entry.entryName}'`
                    );
                }
            }

            zip.extractAllTo(tempDir, /*overwrite*/ true);

            // 2. Read package.json to find the entry point
            let entryRelPath = 'dist/index.js';
            try {
                const pkgRaw = zip.readAsText('package.json');
                const pkg = JSON.parse(pkgRaw) as {main?: string};
                if (typeof pkg.main === 'string') {
                    entryRelPath = pkg.main;
                }
            } catch {
                // no package.json in zip — fall back to dist/index.js
            }

            const entryAbsPath = join(tempDir, entryRelPath);
            const mod = await this.importModule(pathToFileURL(entryAbsPath).href);
            const plugin = mod.default;

            if (!validatePlugin(plugin)) {
                throw new BadRequestException(
                    'Plugin default export does not satisfy the BankScraper interface'
                );
            }

            const bankId = plugin.bankId;

            // 3. Move temp dir to final destination
            const finalDir = join(pluginDir, bankId);
            // Ensure pluginDir exists (may have been removed since startup)
            await mkdir(pluginDir, {recursive: true});
            // Remove existing install if present so rename succeeds
            await rm(finalDir, {recursive: true, force: true});
            await rename(tempDir, finalDir);

            // Install runtime deps; --omit=dev keeps the footprint lean.
            await this.runNpmInstall(finalDir);

            this.logger.log(`Plugin '${bankId}' installed to '${finalDir}'`);

            // 4. Reload
            await this.pluginLoader.loadPlugins();

            return {bankId, pluginDir: finalDir};
        } catch (err) {
            // Clean up temp dir on any failure
            await rm(tempDir, {recursive: true, force: true});
            throw err;
        }
    }

    /**
     * Wraps the dynamic import() call so unit tests can spy on it.
     * @internal
     */
    protected importModule(href: string): Promise<Record<string, unknown>> {
        return import(href) as Promise<Record<string, unknown>>;
    }

    /**
     * Runs `npm install --omit=dev` in the given directory.
     * Wrapped in a protected method so unit tests can spy on it without
     * spawning a real process.
     * @internal
     */
    protected async runNpmInstall(dir: string): Promise<void> {
        await execFileAsync('npm', ['install', '--omit=dev'], {cwd: dir});
    }

    /**
     * Open a Playwright browser, call plugin.login() with the provided inputs,
     * then call plugin.scrapeTransactions() for the resolved lookback period.
     * Returns the raw RawTransaction[] with no database write.
     *
     * Intended as a developer tool for validating plugin correctness.
     *
     * @param bankId - The bankId registered in ScraperRegistry.
     * @param dto    - Request body containing inputs and optional lookbackDays.
     * @throws NotFoundException when bankId is not registered.
     */
    public async testScraper(
        bankId: string,
        dto: TestScraperDto
    ): Promise<TestScraperResponseDto> {
        const plugin = this.registry.findByBankId(bankId);
        if (!plugin) {
            throw new NotFoundException(`No scraper registered for bankId '${bankId}'`);
        }

        const lookbackDays = dto.lookbackDays ?? plugin.maxLookbackDays;
        const endDate      = new Date();
        const startDate    = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

        let transactions: RawTransaction[] = [];

        try {
            await plugin.login(dto.inputs);
            transactions = await plugin.scrapeTransactions(dto.inputs, {
                startDate,
                endDate,
                includePending: plugin.pendingTransactionsIncluded
            });
        } finally {
            await plugin.cleanup?.();
        }

        this.logger.log(
            `Dry-run scrape for '${bankId}' returned ${transactions.length} transaction(s)`
        );

        return {bankId, transactions, count: transactions.length};
    }
}
