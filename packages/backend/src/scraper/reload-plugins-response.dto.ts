import {ApiProperty} from '@nestjs/swagger';

/** Response body returned by POST /admin/scrapers/reload. */
export class ReloadPluginsResponseDto {
    @ApiProperty({
        description: 'Human-readable summary of the reload operation',
        example: 'Plugin reload complete'
    })
    public message!: string;
}
