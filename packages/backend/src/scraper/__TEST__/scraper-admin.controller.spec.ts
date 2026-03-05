import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {BadRequestException} from '@nestjs/common';
import {ScraperAdminController} from '#scraper/scraper-admin.controller.js';
import type {ScraperAdminService} from '#scraper/scraper-admin.service.js';

describe('ScraperAdminController', () => {
    let controller: ScraperAdminController;
    let mockService: {
        reloadPlugins: ReturnType<typeof vi.fn>;
        installPlugin: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockService = {
            reloadPlugins: vi.fn().mockResolvedValue(undefined),
            installPlugin: vi.fn()
        };

        controller = new ScraperAdminController(
            mockService as unknown as ScraperAdminService
        );
    });

    // -----------------------------------------------------------------------
    // reload
    // -----------------------------------------------------------------------

    describe('reload', () => {
        it('should call adminService.reloadPlugins()', async () => {
            await controller.reload();

            expect(mockService.reloadPlugins).toHaveBeenCalledOnce();
        });

        it('should return a message confirming the reload', async () => {
            const result = await controller.reload();

            expect(result).toEqual({message: 'Plugin reload complete'});
        });

        it('should propagate errors from adminService.reloadPlugins()', async () => {
            mockService.reloadPlugins.mockRejectedValue(new Error('Disk error'));

            await expect(controller.reload()).rejects.toThrow('Disk error');
        });
    });

    // -----------------------------------------------------------------------
    // install
    // -----------------------------------------------------------------------

    describe('install', () => {
        const makeFile = (
            originalname: string,
            content = 'export default {}'
        ): Express.Multer.File =>
            ({
                originalname,
                buffer: Buffer.from(content),
                mimetype: 'application/javascript',
                size: content.length,
                fieldname: 'file',
                encoding: '7bit',
                stream: undefined,
                destination: '',
                filename: originalname,
                path: ''
            }) as unknown as Express.Multer.File;

        it('should throw BadRequestException when no file is uploaded', async () => {
            await expect(controller.install(undefined)).rejects.toThrow(
                BadRequestException
            );
            await expect(controller.install(undefined)).rejects.toThrow(
                '"file" field'
            );
        });

        it('should call adminService.installPlugin with filename and buffer', async () => {
            const file = makeFile('cibc.js');
            mockService.installPlugin.mockResolvedValue('cibc.js');

            await controller.install(file);

            expect(mockService.installPlugin).toHaveBeenCalledOnce();
            expect(mockService.installPlugin).toHaveBeenCalledWith(
                'cibc.js',
                file.buffer
            );
        });

        it('should return a success response with filename', async () => {
            const file = makeFile('cibc.js');
            mockService.installPlugin.mockResolvedValue('cibc.js');

            const result = await controller.install(file);

            expect(result).toEqual({
                message: 'Plugin cibc.js installed and loaded successfully',
                filename: 'cibc.js'
            });
        });

        it('should propagate BadRequestException from adminService.installPlugin', async () => {
            const file = makeFile('plugin.ts'); // invalid extension
            mockService.installPlugin.mockRejectedValue(
                new BadRequestException('Only .js plugin files are accepted')
            );

            await expect(controller.install(file)).rejects.toThrow(BadRequestException);
        });
    });
});
