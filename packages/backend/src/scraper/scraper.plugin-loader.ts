import {
    Injectable,
    Logger,
    OnModuleInit
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {readdir} from 'fs/promises';
import {join} from 'path';
import {pathToFileURL} from 'url';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';

/**
 * Type guard — returns true only when the value satisfies every field of the
 * BankScraper interface. Used to validate dynamic plugin exports at runtime.
 */
const isBankScraper = (value: unknown): value is BankScraper => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const v = value as Record<string, unknown>;
    return (
        typeof v.bankId === 'string' &&
        typeof v.displayName === 'string' &&
        typeof v.requiresMfaOnEveryRun === 'boolean' &&
        typeof v.maxLookbackDays === 'number' &&
        typeof v.pendingTransactionsIncluded === 'boolean' &&
        typeof v.login === 'function' &&
        typeof v.scrapeTransactions === 'function'
    );
};

/**
 * ScraperPluginLoader loads external BankScraper implementations from
 * the directory specified by the SCRAPER_PLUGIN_DIR environment variable.
 *
 * Each .js file in that directory must have a default export that satisfies
 * the BankScraper interface. Valid plugins are registered into ScraperRegistry
 * so they appear in GET /scrapers and can be targeted by SyncSchedule records.
 *
 * Called automatically on module init and by the admin reload endpoint
 * (POST /admin/scrapers/reload) to pick up newly installed plugins without
 * restarting the server.
 */
@Injectable()
export class ScraperPluginLoader implements OnModuleInit {
    private readonly logger = new Logger(ScraperPluginLoader.name);

    constructor(
        private readonly config: ConfigService,
        private readonly registry: ScraperRegistry
    ) {}

    public async onModuleInit(): Promise<void> {
        await this.loadPlugins();
    }

    /**
     * Scan SCRAPER_PLUGIN_DIR for .js files, dynamically import each one,
     * validate the default export, and register valid scrapers into
     * ScraperRegistry.
     *
     * Individual plugin failures are caught and logged as warnings so a
     * single broken plugin cannot prevent the server from starting or other
     * plugins from loading. Filesystem errors (e.g. permission denied on the
     * directory) are re-thrown so the caller can surface them.
     */
    public async loadPlugins(): Promise<void> {
        const pluginDir = this.config.get<string>('SCRAPER_PLUGIN_DIR');

        if (!pluginDir) {
            this.logger.log('SCRAPER_PLUGIN_DIR not set — plugin loading skipped');
            return;
        }

        let files: string[];
        try {
            const entries = await readdir(pluginDir, {withFileTypes: true});
            files = entries
                .filter(e => e.isFile() && e.name.endsWith('.js'))
                .map(e => join(pluginDir, e.name));
        } catch (err) {
            this.logger.error(
                `Failed to read plugin directory '${pluginDir}'`,
                (err as Error).stack
            );
            throw err;
        }

        if (files.length === 0) {
            this.logger.log(`No plugin files found in '${pluginDir}'`);
            return;
        }

        let registered = 0;
        for (const filePath of files) {
            try {
                const href = pathToFileURL(filePath).href;
                // Sequential import is intentional — isolates per-plugin failures
                 
                const mod = await this.loadModule(href);
                const plugin = mod.default;

                if (!isBankScraper(plugin)) {
                    this.logger.warn(
                        `Plugin '${filePath}' skipped — default export does not ` +
                        'satisfy BankScraper interface'
                    );
                    continue;
                }

                this.registry.register(plugin);
                registered++;
                this.logger.log(
                    `Plugin '${plugin.bankId}' registered from '${filePath}'`
                );
            } catch (err) {
                this.logger.warn(
                    `Plugin '${filePath}' failed to load: ${(err as Error).message}`
                );
            }
        }

        this.logger.log(
            `Plugin loading complete — ${registered}/${files.length} plugin(s) registered`
        );
    }

    /**
     * Wraps the dynamic import() call so unit tests can spy on it without
     * touching the real filesystem or Node module cache.
     * @internal
     */
    protected loadModule(href: string): Promise<Record<string, unknown>> {
        return import(href) as Promise<Record<string, unknown>>;
    }
}
