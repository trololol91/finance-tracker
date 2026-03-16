import {
    ApiProperty,
    ApiPropertyOptional
} from '@nestjs/swagger';

export class PluginFieldDescriptorDto {
    @ApiProperty({example: 'username', description: 'Field key used in the inputs map'})
    public key!: string;

    @ApiProperty({example: 'Username', description: 'Human-readable label for the field'})
    public label!: string;

    @ApiProperty({
        enum: ['text', 'password', 'number', 'select'],
        description: 'Input type for the field'
    })
    public type!: 'text' | 'password' | 'number' | 'select';

    @ApiProperty({example: true, description: 'Whether this field is required'})
    public required!: boolean;

    @ApiPropertyOptional({
        example: 'Your online banking username',
        description: 'Optional hint text displayed below the field'
    })
    public hint?: string;

    @ApiPropertyOptional({
        type: 'array',
        items: {
            type: 'object',
            properties: {
                value: {type: 'string'},
                label: {type: 'string'}
            }
        },
        description: 'Options for select-type fields'
    })
    public options?: {value: string, label: string}[];
}

/**
 * Serialisable scraper metadata returned by GET /scrapers.
 * Mirrors the ScraperInfo interface but as a class so Swagger can introspect it.
 */
export class ScraperInfoDto {
    @ApiProperty({example: 'cibc', description: 'Unique bank identifier'})
    public bankId!: string;

    @ApiProperty({example: 'CIBC', description: 'Human-readable bank name'})
    public displayName!: string;

    @ApiProperty({
        example: true,
        description: 'Whether an MFA challenge is required on every scraper run'
    })
    public requiresMfaOnEveryRun!: boolean;

    @ApiProperty({
        example: 90,
        description: 'Maximum number of days in the past the scraper can retrieve'
    })
    public maxLookbackDays!: number;

    @ApiProperty({
        example: false,
        description: 'Whether the scraper returns pending (un-posted) transactions'
    })
    public pendingTransactionsIncluded!: boolean;

    @ApiProperty({
        type: () => [PluginFieldDescriptorDto],
        description: 'Fields the plugin requires from the user'
    })
    public inputSchema!: PluginFieldDescriptorDto[];
}
