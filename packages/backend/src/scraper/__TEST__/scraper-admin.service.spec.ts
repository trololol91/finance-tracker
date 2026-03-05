import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {BadRequestException} from '@nestjs/common';
import {ScraperAdminService} from '#scraper/scraper-admin.service.js';
import type {ConfigService} from '@nestjs/config';
import type {ScraperPluginLoader} from '#scraper/scraper.plugin-loader.js';

vi.mock('fs/promises', () => ({
    writeFile: vi.fn()
}));

import {writeFile} from 'fs/promises';

describe('ScraperAdminService', () => {
    let service: ScraperAdminService;
    let mockConfig: {get: ReturnType<typeof vi.fn>};
    let mockLoader: {loadPlugins: ReturnType<typeof vi.fn>};

    beforeEach(() => {
        vi.clearAllMocks();

        mockConfig = {get: vi.fn()};
        mockLoader = {loadPlugins: vi.fn().mockResolvedValue(undefined)};

        service = new ScraperAdminService(
            mockConfig as unknown as ConfigService,
            mockLoader as unknown as ScraperPluginLoader
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

        it('should throw BadRequestException for a filename with invalid characters', () => {
            expect(() => service.sanitiseFilename('bad file!.js')).toThrow(BadRequestException);
            expect(() => service.sanitiseFilename('bad file!.js')).toThrow('Invalid plugin filename');
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
});
