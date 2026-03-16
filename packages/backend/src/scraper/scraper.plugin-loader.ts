import {
    Injectable,
    Logger,
    OnModuleInit
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {constants} from 'fs';
import {
    readdir, copyFile, access
} from 'fs/promises';
import {
    join, basename
} from 'path';
import {
    pathToFileURL, fileURLToPath
} from 'url';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';

/** Built-in plugin filenames compiled alongside this module under `banks/`. */
const BUILTIN_PLUGINS = ['cibc.scraper.js', 'td.scraper.js'];

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
        Array.isArray(v.inputSchema) &&
        typeof v.login === 'function' &&
        typeof v.scrapeTransactions === 'function'
    );
};

/**
 * ScraperPluginLoader loads external BankScraper implementations from
 * the directory specified by the SCRAPER_PLUGIN_DIR environment variable.
 *
 * On module init it first seeds built-in plugins (cibc, td) into
 * SCRAPER_PLUGIN_DIR if they are not already present (idempotent — an
 * operator-modified file is never overwritten). It then scans the directory
 * and registers all valid .js plugins into ScraperRegistry.
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
        await this.seedBuiltins();
        await this.loadPlugins();
    }

    /**
     * Copy each built-in plugin file into SCRAPER_PLUGIN_DIR if it is not
     * already present. An existing file (including an operator-modified one)
     * is never overwritten — the copy is strictly copy-on-missing.
     *
     * Non-ENOENT filesystem errors (e.g. EACCES) are re-thrown so the
     * operator is notified of permission problems at startup.
     */
    private async seedBuiltins(): Promise<void> {
        const pluginDir = this.config.get<string>('SCRAPER_PLUGIN_DIR');

        if (!pluginDir) {
            this.logger.log('SCRAPER_PLUGIN_DIR not set — built-in plugin seeding skipped');
            return;
        }

        const builtinDir = join(fileURLToPath(new URL('.', import.meta.url)), 'banks');

        for (const filename of BUILTIN_PLUGINS) {
            const src = join(builtinDir, filename);
            const dest = join(pluginDir, filename);

            try {
                await access(dest, constants.F_OK);
                this.logger.log(
                    `Built-in plugin '${basename(dest)}' already exists — skipping seed`
                );
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw err;
                }
                await copyFile(src, dest);
                this.logger.log(
                    `Seeded built-in plugin '${filename}' → ${dest}`
                );
            }
        }
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
