import {ApiProperty} from '@nestjs/swagger';

/** Response body returned by POST /admin/scrapers/install. */
export class InstallPluginResponseDto {
    @ApiProperty({
        description: 'Human-readable summary of the install operation',
        example: 'Plugin cibc installed and loaded successfully'
    })
    public message!: string;

    @ApiProperty({
        description: 'bankId from the plugin\'s default export',
        example: 'cibc'
    })
    public bankId!: string;

    @ApiProperty({
        description: 'Absolute path of the directory written to SCRAPER_PLUGIN_DIR',
        example: '/plugins/cibc'
    })
    public pluginDir!: string;
}
