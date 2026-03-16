import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {writeFile} from 'fs/promises';
import {join} from 'path';
import {ScraperPluginLoader} from '#scraper/scraper.plugin-loader.js';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {
    BankCredentials, RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';
import {TestScraperDto} from '#scraper/admin/dto/test-scraper.dto.js';
import {TestScraperResponseDto} from '#scraper/admin/dto/test-scraper-response.dto.js';
import type {
    Browser, Page
} from 'playwright';

/**
 * ScraperAdminService provides the business logic for the admin plugin
 * management endpoints.
 *
 * - reloadPlugins(): re-scans SCRAPER_PLUGIN_DIR and registers any plugins
 *   found, picking up files added since the last load without restarting.
 * - installPlugin(): writes a validated .js buffer to SCRAPER_PLUGIN_DIR
 *   and then calls reloadPlugins() so the plugin is immediately active.
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
     * Write a plugin file to SCRAPER_PLUGIN_DIR and reload all plugins.
     *
     * @param originalname - The original filename from the upload (will be sanitised).
     * @param buffer       - Raw file bytes to write.
     * @returns The sanitised filename that was written.
     * @throws BadRequestException when SCRAPER_PLUGIN_DIR is not configured,
     *         the filename is invalid, or the file is not a .js file.
     */
    public async installPlugin(originalname: string, buffer: Buffer): Promise<string> {
        const pluginDir = this.config.get<string>('SCRAPER_PLUGIN_DIR');
        if (!pluginDir) {
            throw new BadRequestException(
                'SCRAPER_PLUGIN_DIR is not configured — plugin installation is disabled'
            );
        }

        const filename = this.sanitiseFilename(originalname);

        const dest = join(pluginDir, filename);
        this.logger.log(`Admin installing plugin to '${dest}'`);

        await writeFile(dest, buffer);
        this.logger.log(`Plugin file written: ${dest}`);

        await this.pluginLoader.loadPlugins();

        return filename;
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

        const {chromium} = await import('playwright');
        let browser: Browser | undefined;
        let page: Page | undefined;

        let transactions: RawTransaction[] = [];

        try {
            browser = await chromium.launch({headless: true});
            page = await browser.newPage();
            // Milestone 4 will replace BankCredentials with PluginInputs = Record<string, string>.
            // Until then, cast is safe: dto.inputs is Record<string, string> and all built-in
            // scrapers destructure only { username, password } from the credentials argument.
            await plugin.login(page, dto.inputs as unknown as BankCredentials);
            transactions = await plugin.scrapeTransactions(page, {
                startDate,
                endDate,
                includePending: plugin.pendingTransactionsIncluded
            });
        } finally {
            await browser?.close();
        }

        this.logger.log(
            `Dry-run scrape for '${bankId}' returned ${transactions.length} transaction(s)`
        );

        return {bankId, transactions, count: transactions.length};
    }

    /**
     * Strip path components and validate that the filename is a .js file.
     * Allows only word chars, hyphens, dots, and digits with a .js extension.
     *
     * @throws BadRequestException for invalid or unsafe filenames.
     */
    public sanitiseFilename(originalname: string): string {
        // Strip any directory prefix an attacker might inject, then normalise
        // to lowercase so that 'CIBC.JS' and 'cibc.js' are treated the same
        // and the written filename is always lowercase.
        const basename = originalname.replace(/^.*[\\/]/, '').toLowerCase();

        if (!basename) {
            throw new BadRequestException('Plugin filename must not be empty');
        }

        if (!basename.endsWith('.js')) {
            throw new BadRequestException('Only .js plugin files are accepted');
        }

        // Allow only safe characters: word chars, hyphens, dots, digits.
        // First char must be a word char (letter, digit, underscore) to prevent
        // leading-dot filenames such as '.hidden.js' or '..cibc.js'.
        if (!/^\w[\w.-]*\.js$/.test(basename)) {
            throw new BadRequestException(
                `Invalid plugin filename '${basename}' — use only letters, digits, hyphens, and dots`
            );
        }

        return basename;
    }
}
