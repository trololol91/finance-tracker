import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    ParseUUIDPipe,
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
    ApiParam,
    ApiConsumes,
    ApiBody,
    ApiBearerAuth
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';
import {ImportService} from '#scraper/import/import.service.js';
import {ImportJobResponseDto} from '#scraper/import/import-job-response.dto.js';
import {UploadImportDto} from '#scraper/import/upload-import.dto.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIMETYPES = [
    'text/csv',
    'application/csv',
    'application/x-ofx',
    'application/octet-stream'
];

@ApiTags('import')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('scraper/import')
export class ImportController {
    constructor(private readonly importService: ImportService) {}

    /** Returns true if the file should be accepted, false otherwise. */
    public static isFileAllowed(file: {mimetype: string, originalname: string}): boolean {
        const ext = file.originalname.toLowerCase();
        return (
            ALLOWED_MIMETYPES.includes(file.mimetype) ||
            ext.endsWith('.csv') ||
            ext.endsWith('.ofx')
        );
    }

    /**
     * Upload a CSV or OFX file for import.
     * POST /scraper/import/upload
     */
    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {fileSize: MAX_FILE_SIZE_BYTES},
            /* v8 ignore next 6 */
            fileFilter: (_req, file, cb) => {
                if (ImportController.isFileAllowed(file)) {
                    cb(null, true);
                } else {
                    cb(new BadRequestException('Only CSV and OFX files are accepted'), false);
                }
            }
        })
    )
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'CSV or OFX file upload',
        schema: {
            type: 'object',
            properties: {
                file: {type: 'string', format: 'binary'},
                accountId: {type: 'string', description: 'Target account UUID (optional)'}
            },
            required: ['file']
        }
    })
    @ApiOperation({
        summary: 'Upload transactions file',
        description:
            'Upload a CSV or OFX file to import transactions. ' +
            'File size limit: 5 MB. Returns the created ImportJob with parse results.'
    })
    @ApiResponse({status: 201, description: 'Import job created', type: ImportJobResponseDto})
    @ApiResponse({status: 400, description: 'Missing file, unsupported type, or file too large'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Account not found or belongs to another user'})
    public async upload(
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body() dto: UploadImportDto,
        @CurrentUser() currentUser: User
    ): Promise<ImportJobResponseDto> {
        if (!file) {
            throw new BadRequestException('No file attached. Send the file in a "file" multipart field.');
        }
        return this.importService.upload(currentUser.id, file, dto.accountId);
    }

    /**
     * List all import jobs for the authenticated user.
     * GET /scraper/import
     */
    @Get()
    @ApiOperation({
        summary: 'List import jobs',
        description: 'Get all import jobs for the authenticated user, newest first.'
    })
    @ApiResponse({status: 200, description: 'List of import jobs', type: [ImportJobResponseDto]})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findAll(@CurrentUser() currentUser: User): Promise<ImportJobResponseDto[]> {
        return this.importService.findAll(currentUser.id);
    }

    /**
     * Get a single import job by ID.
     * GET /scraper/import/:id
     */
    @Get(':id')
    @ApiOperation({
        summary: 'Get import job by ID',
        description: 'Get a specific import job. Returns 404 if not found or belongs to another user.'
    })
    @ApiParam({name: 'id', description: 'Import job UUID', type: String})
    @ApiResponse({status: 200, description: 'Import job found', type: ImportJobResponseDto})
    @ApiResponse({status: 400, description: 'Invalid UUID format'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Import job not found'})
    public async findOne(
        @Param('id', new ParseUUIDPipe({version: '4'})) id: string,
        @CurrentUser() currentUser: User
    ): Promise<ImportJobResponseDto> {
        return this.importService.findOne(currentUser.id, id);
    }
}
