import {ApiProperty} from '@nestjs/swagger';

/** Response body returned by POST /admin/scrapers/install. */
export class InstallPluginResponseDto {
    @ApiProperty({
        description: 'Human-readable summary of the install operation',
        example: 'Plugin cibc-plugin.js installed and loaded successfully'
    })
    public message!: string;

    @ApiProperty({
        description: 'Sanitised filename that was written to SCRAPER_PLUGIN_DIR',
        example: 'cibc-plugin.js'
    })
    public filename!: string;
}
