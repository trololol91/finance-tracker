import {ApiProperty} from '@nestjs/swagger';

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
}
