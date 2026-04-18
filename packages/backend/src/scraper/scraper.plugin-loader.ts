import {
    Injectable,
    Logger,
    OnModuleInit
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {
    readdir, readFile
} from 'fs/promises';
import {join} from 'path';
import {pathToFileURL} from 'url';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import {validatePlugin} from '@finance-tracker/plugin-sdk/testing';

/**
 * ScraperPluginLoader loads external BankScraper implementations from
 * the directory specified by the SCRAPER_PLUGIN_DIR environment variable.
 *
 * On module init it scans the directory and registers all valid plugins
 * into ScraperRegistry. Scrapers are distributed separately as zip files
 * and are expected to be pre-installed in SCRAPER_PLUGIN_DIR by the operator.
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
     * Scan SCRAPER_PLUGIN_DIR for subdirectories, resolve each one's entry
     * point (via package.json#main or index.js), dynamically import it,
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

        let subdirs: string[];
        try {
            const entries = await readdir(pluginDir, {withFileTypes: true});
            subdirs = entries
                .filter(e => e.isDirectory())
                .map(e => join(pluginDir, e.name));
        } catch (err) {
            this.logger.error(
                `Failed to read plugin directory '${pluginDir}'`,
                (err as Error).stack
            );
            throw err;
        }

        if (subdirs.length === 0) {
            this.logger.log(`No plugin subdirectories found in '${pluginDir}'`);
            return;
        }

        let registered = 0;
        for (const subdir of subdirs) {
            try {
                const filePath = await this.findEntryPoint(subdir);
                const href = pathToFileURL(filePath).href;
                // Sequential import is intentional — isolates per-plugin failures

                const mod = await this.loadModule(href);
                const plugin = mod.default;

                if (!validatePlugin(plugin)) {
                    this.logger.warn(
                        `Plugin in '${subdir}' skipped — default export does not ` +
                        'satisfy BankScraper interface'
                    );
                    continue;
                }

                this.registry.register(plugin, href);
                registered++;
                this.logger.log(
                    `Plugin '${plugin.bankId}' registered from '${filePath}'`
                );
            } catch (err) {
                this.logger.warn(
                    `Plugin in '${subdir}' failed to load: ${(err as Error).message}`
                );
            }
        }

        this.logger.log(
            `Plugin loading complete — ${registered}/${subdirs.length} plugin(s) registered`
        );
    }

    /**
     * Resolves the entry-point file for a plugin subdirectory.
     * Reads `package.json#main` if present; falls back to `index.js`.
     * Any error reading or parsing `package.json` is silently ignored.
     */
    private async findEntryPoint(subdir: string): Promise<string> {
        try {
            const content = await readFile(join(subdir, 'package.json'), {encoding: 'utf-8'});
            const pkg = JSON.parse(content) as {main?: string};
            if (typeof pkg.main === 'string') {
                return join(subdir, pkg.main);
            }
        } catch {
            // no package.json or parse error — fall through to index.js
        }
        return join(subdir, 'index.js');
    }

    /**
     * Wraps the dynamic import() call so unit tests can spy on it without
     * touching the real filesystem or Node module cache.
     *
     * A cache-busting query string is appended so that reloading a plugin
     * after an on-disk update bypasses the Node.js ESM module cache, which
     * would otherwise return the stale cached module for the same URL.
     * @internal
     */
    protected loadModule(href: string): Promise<Record<string, unknown>> {
        const bustUrl = `${href}?t=${Date.now()}`;
        return import(bustUrl) as Promise<Record<string, unknown>>;
    }
}
