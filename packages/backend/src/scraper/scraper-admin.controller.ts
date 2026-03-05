import {
    Controller,
    Post,
    HttpCode,
    HttpStatus,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException
} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiBody
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {AdminGuard} from '#common/guards/admin.guard.js';
import {ScraperAdminService} from '#scraper/scraper-admin.service.js';
import {ReloadPluginsResponseDto} from '#scraper/reload-plugins-response.dto.js';
import {InstallPluginResponseDto} from '#scraper/install-plugin-response.dto.js';

const MAX_PLUGIN_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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
    @HttpCode(HttpStatus.OK)
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
        status: 200,
        description: 'Plugin installed and registered successfully',
        type: InstallPluginResponseDto
    })
    @ApiResponse({status: 400, description: 'Invalid file type, unsafe filename, or SCRAPER_PLUGIN_DIR not configured'})
    @ApiResponse({status: 401, description: 'Missing or invalid JWT token'})
    @ApiResponse({status: 403, description: 'Caller is not an ADMIN user'})
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {fileSize: MAX_PLUGIN_SIZE_BYTES}
        })
    )
    public async install(
        @UploadedFile() file: Express.Multer.File | undefined
    ): Promise<InstallPluginResponseDto> {
        if (!file) {
            throw new BadRequestException('A .js plugin file must be uploaded under the "file" field');
        }

        const filename = await this.adminService.installPlugin(
            file.originalname,
            file.buffer
        );

        return {
            message: `Plugin ${filename} installed and loaded successfully`,
            filename
        };
    }
}
