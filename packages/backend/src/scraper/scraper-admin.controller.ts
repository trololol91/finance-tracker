import {
    Controller,
    Post,
    HttpCode,
    HttpStatus,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Param,
    Body
} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiBody,
    ApiParam
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {AdminGuard} from '#common/guards/admin.guard.js';
import {ScraperAdminService} from '#scraper/scraper-admin.service.js';
import {ReloadPluginsResponseDto} from '#scraper/reload-plugins-response.dto.js';
import {InstallPluginResponseDto} from '#scraper/install-plugin-response.dto.js';
import {TestScraperDto} from '#scraper/admin/dto/test-scraper.dto.js';
import {TestScraperResponseDto} from '#scraper/admin/dto/test-scraper-response.dto.js';

const MAX_PLUGIN_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Admin-only endpoints for managing external bank scraper plugins at runtime.
 * Both endpoints require a valid JWT token belonging to an ADMIN user.
 */
@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/scrapers')
export class ScraperAdminController {
    constructor(private readonly adminService: ScraperAdminService) {}

    /**
     * POST /admin/scrapers/reload
     *
     * Re-scan SCRAPER_PLUGIN_DIR and register any plugins found, picking up
     * files placed there since the last load without restarting the server.
     */
    @Post('reload')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Reload external scraper plugins',
        description:
            'Re-scans SCRAPER_PLUGIN_DIR and registers any valid .js plugins found. ' +
            'Existing registrations with the same bankId are overwritten. ' +
            'Requires ADMIN role. No request body required.'
    })
    @ApiResponse({
        status: 200,
        description: 'Plugin reload initiated successfully',
        type: ReloadPluginsResponseDto
    })
    @ApiResponse({status: 401, description: 'Missing or invalid JWT token'})
    @ApiResponse({status: 403, description: 'Caller is not an ADMIN user'})
    public async reload(): Promise<ReloadPluginsResponseDto> {
        await this.adminService.reloadPlugins();
        return {message: 'Plugin reload complete'};
    }

    /**
     * POST /admin/scrapers/install
     *
     * Upload a .js plugin file, write it to SCRAPER_PLUGIN_DIR, and
     * immediately reload all plugins so the new scraper is active.
     */
    @Post('install')
    @HttpCode(HttpStatus.CREATED)
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'The .js plugin file to install',
        schema: {
            type: 'object',
            required: ['file'],
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'A .js file whose default export satisfies BankScraper'
                }
            }
        }
    })
    @ApiOperation({
        summary: 'Install a new scraper plugin',
        description:
            'Upload a .js plugin file. It is written to SCRAPER_PLUGIN_DIR and ' +
            'loadPlugins() is called so the new plugin is immediately available. ' +
            'The default export must satisfy the BankScraper interface. ' +
            'Requires ADMIN role. Only .js files up to 10 MB are accepted.'
    })
    @ApiResponse({
        status: 201,
        description: 'Plugin installed and registered successfully',
        type: InstallPluginResponseDto
    })
    @ApiResponse({status: 400, description: 'Invalid file type, unsafe filename, or SCRAPER_PLUGIN_DIR not configured'})
    @ApiResponse({status: 401, description: 'Missing or invalid JWT token'})
    @ApiResponse({status: 403, description: 'Caller is not an ADMIN user'})
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {fileSize: MAX_PLUGIN_SIZE_BYTES},
            fileFilter: (_req, file, cb) => {
                if (file.originalname.toLowerCase().endsWith('.zip')) {
                    cb(null, true);
                } else {
                    cb(new BadRequestException('Only .zip plugin packages are accepted'), false);
                }
            }
        })
    )
    public async install(
        @UploadedFile() file: Express.Multer.File | undefined
    ): Promise<InstallPluginResponseDto> {
        if (!file) {
            throw new BadRequestException('A .zip plugin package must be uploaded under the "file" field');
        }

        const {bankId, pluginDir} = await this.adminService.installPlugin(file.buffer);

        return {
            message: `Plugin ${bankId} installed and loaded successfully`,
            bankId,
            pluginDir
        };
    }

    /**
     * POST /admin/scrapers/:bankId/test
     *
     * Run a full login + scrape cycle for the given bankId using the provided
     * inputs, and return the raw RawTransaction[] without writing to the database.
     * Intended as a developer tool for validating plugin correctness.
     */
    @Post(':bankId/test')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Dry-run a scraper plugin',
        description:
            'Opens a Playwright browser, calls plugin.login() with the provided inputs, ' +
            'then calls plugin.scrapeTransactions() for the specified lookback period. ' +
            'Returns the raw RawTransaction[] with no database write. ' +
            'Requires ADMIN role. Returns 404 if bankId is not registered.'
    })
    @ApiParam({
        name: 'bankId',
        description: 'Unique bank identifier registered in ScraperRegistry (e.g. cibc, td)',
        example: 'cibc'
    })
    @ApiBody({type: TestScraperDto})
    @ApiResponse({
        status: 200,
        description: 'Scrape completed. Raw transactions returned.',
        type: TestScraperResponseDto
    })
    @ApiResponse({status: 400, description: 'Request body fails validation'})
    @ApiResponse({status: 401, description: 'Missing or invalid JWT token'})
    @ApiResponse({status: 403, description: 'Caller is not an ADMIN user'})
    @ApiResponse({status: 404, description: 'No scraper registered for the given bankId'})
    public async testScraper(
        @Param('bankId') bankId: string,
        @Body() dto: TestScraperDto
    ): Promise<TestScraperResponseDto> {
        return this.adminService.testScraper(bankId, dto);
    }
}
