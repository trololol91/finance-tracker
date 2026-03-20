import {
    Injectable,
    Logger,
    OnModuleInit
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {constants} from 'fs';
import {
    readdir, access, readFile, cp
} from 'fs/promises';
import {join} from 'path';
import {
    pathToFileURL, fileURLToPath
} from 'url';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import {validatePlugin} from '@finance-tracker/plugin-sdk/testing';

/**
 * Names of the built-in scraper workspace packages under packages/.
 * Each is copied in full (dist/ + node_modules/) to SCRAPER_PLUGIN_DIR/<bankId>/
 * during seeding, giving every plugin an isolated node_modules.
 */
const BUILTIN_PLUGINS = ['scraper-cibc', 'scraper-stub'];

/**
 * ScraperPluginLoader loads external BankScraper implementations from
 * the directory specified by the SCRAPER_PLUGIN_DIR environment variable.
 *
 * On module init it first seeds built-in plugins (cibc, stub) into
 * SCRAPER_PLUGIN_DIR if they are not already present (idempotent — an
 * operator-modified file is never overwritten). It then scans the directory
 * and registers all valid plugins into ScraperRegistry.
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
     * Copy each built-in plugin directory into SCRAPER_PLUGIN_DIR if it is not
     * already present. An existing install (including an operator-modified one)
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

        // Compiled file lives at dist/scraper/ — four levels up reaches the repo root
        const workspaceRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

        await Promise.all(BUILTIN_PLUGINS.map(async pkgName => {
            // 'scraper-cibc' → dest dir name 'cibc'
            const bankId = pkgName.replace(/^scraper-/, '');
            const srcDir = join(workspaceRoot, 'packages', pkgName);
            const destDir = join(pluginDir, bankId);
            // Skip seed if the compiled entry point already exists (idempotent)
            const entryPoint = join(destDir, 'dist', 'index.js');

            try {
                await access(entryPoint, constants.F_OK);
                this.logger.log(
                    `Built-in plugin '${bankId}' already exists — skipping seed`
                );
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw err;
                }
                await cp(srcDir, destDir, {recursive: true});
                this.logger.log(
                    `Seeded built-in plugin '${bankId}' from '${srcDir}' → '${destDir}'`
                );
            }
        }));
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
     * @internal
     */
    protected loadModule(href: string): Promise<Record<string, unknown>> {
        return import(href) as Promise<Record<string, unknown>>;
    }
}
