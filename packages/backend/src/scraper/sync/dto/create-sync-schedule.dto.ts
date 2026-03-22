import {
    ApiProperty,
    ApiPropertyOptional
} from '@nestjs/swagger';
import {
    IsString,
    IsUUID,
    IsNotEmpty,
    IsOptional,
    IsInt,
    IsBoolean,
    IsObject,
    Min,
    Max,
    Validate
} from 'class-validator';
import {IsStringRecord} from '#common/validators/is-string-record.validator.js';
import {RequiredInputsConstraint} from '#common/validators/required-inputs.validator.js';

export class CreateSyncScheduleDto {
    @ApiProperty({description: 'Account UUID to sync transactions into'})
    @IsUUID('4')
    public accountId!: string;

    @ApiProperty({
        description: 'Bank identifier (must match a registered BankScraper.bankId)',
        example: 'cibc'
    })
    @IsString()
    @IsNotEmpty()
    public bankId!: string;

    @ApiProperty({
        description: 'Plugin-specific input fields — keys and expected values are defined dynamically by the selected bank\'s inputSchema',
        example: {key1: 'value1', key2: 'value2'}
    })
    @IsObject()
    @IsStringRecord()
    @Validate(RequiredInputsConstraint)
    public inputs!: Record<string, string>;

    @ApiProperty({
        description: 'Cron expression for the sync schedule (e.g. \'0 8 * * *\')',
        example: '0 8 * * *'
    })
    @IsString()
    @IsNotEmpty()
    public cron!: string;

    @ApiPropertyOptional({
        description: 'Days to look back for overlapping transactions (default: 3)',
        minimum: 1,
        maximum: 365
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(365)
    public lookbackDays?: number;

    @ApiPropertyOptional({
        description: 'Automatically categorize imported transactions using LLM (default: false)'
    })
    @IsOptional()
    @IsBoolean()
    public autoCategorizeLlm?: boolean;
}
