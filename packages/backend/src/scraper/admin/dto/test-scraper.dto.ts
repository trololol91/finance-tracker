import {
    IsObject, IsOptional, IsInt, IsPositive
} from 'class-validator';
import {
    ApiProperty, ApiPropertyOptional
} from '@nestjs/swagger';

export class TestScraperDto {
    @ApiProperty({
        description: 'Key-value map of inputs passed directly to plugin.login(). ' +
            'Keys and values are plugin-specific (e.g. username, password, card number).',
        example: {username: 'user@example.com', password: 'hunter2'},
        type: 'object',
        additionalProperties: {type: 'string'}
    })
    // @IsObject() confirms the value is a plain object; it does not validate that
    // record values are strings. Full value-type validation is deferred to Milestone 4,
    // which replaces BankCredentials with PluginInputs = Record<string, string> and
    // will introduce schema-driven input validation via the plugin's inputSchema.
    @IsObject()
    public inputs!: Record<string, string>;

    @ApiPropertyOptional({
        description:
            'Number of calendar days back from today to scrape. ' +
            'Defaults to the plugin\'s maxLookbackDays when omitted. ' +
            'Must be a positive integer.',
        example: 30
    })
    @IsOptional()
    @IsInt()
    @IsPositive()
    public lookbackDays?: number;
}
