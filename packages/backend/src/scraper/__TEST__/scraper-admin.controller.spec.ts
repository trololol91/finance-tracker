import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    BadRequestException, NotFoundException
} from '@nestjs/common';
import {ScraperAdminController} from '#scraper/scraper-admin.controller.js';
import type {ScraperAdminService} from '#scraper/scraper-admin.service.js';

describe('ScraperAdminController', () => {
    let controller: ScraperAdminController;
    let mockService: {
        reloadPlugins: ReturnType<typeof vi.fn>;
        installPlugin: ReturnType<typeof vi.fn>;
        testScraper: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockService = {
            reloadPlugins: vi.fn().mockResolvedValue(undefined),
            installPlugin: vi.fn(),
            testScraper: vi.fn()
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

    // -----------------------------------------------------------------------
    // testScraper
    // -----------------------------------------------------------------------

    describe('testScraper', () => {
        it('should call adminService.testScraper with bankId and dto and return the result', async () => {
            const dto = {inputs: {username: 'u', password: 'p'}};
            mockService.testScraper.mockResolvedValue({
                bankId: 'cibc',
                transactions: [],
                count: 0
            });

            const result = await controller.testScraper('cibc', dto);

            expect(mockService.testScraper).toHaveBeenCalledWith('cibc', dto);
            expect(result).toEqual({bankId: 'cibc', transactions: [], count: 0});
        });

        it('should propagate NotFoundException from adminService.testScraper', async () => {
            const dto = {inputs: {}};
            mockService.testScraper.mockRejectedValue(
                new NotFoundException('No scraper for cibc')
            );

            await expect(controller.testScraper('cibc', dto)).rejects.toThrow(NotFoundException);
        });

        it('should return all transactions returned by the service without modification', async () => {
            mockService.testScraper.mockResolvedValue({
                bankId: 'td',
                transactions: [
                    {date: '2026-03-01', description: 'Coffee', amount: -3.50, pending: false, syntheticId: 'x'}
                ],
                count: 1
            });

            const result = await controller.testScraper('td', {inputs: {}});

            expect(result.count).toBe(1);
            expect(result.transactions).toHaveLength(1);
        });

        it('should propagate unexpected errors from adminService.testScraper', async () => {
            mockService.testScraper.mockRejectedValue(new Error('Playwright crashed'));

            await expect(
                controller.testScraper('cibc', {inputs: {}})
            ).rejects.toThrow('Playwright crashed');
        });
    });
});
