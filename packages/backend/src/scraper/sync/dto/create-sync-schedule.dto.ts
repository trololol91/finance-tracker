import {
    ApiProperty,
    ApiPropertyOptional
} from '@nestjs/swagger';
import {
    IsString,
    IsUUID,
    IsNotEmpty,
    MinLength,
    IsOptional,
    IsInt,
    Min,
    Max
} from 'class-validator';

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

    @ApiProperty({description: 'Online banking username'})
    @IsString()
    @IsNotEmpty()
    public username!: string;

    @ApiProperty({description: 'Online banking password', minLength: 1})
    @IsString()
    @MinLength(1)
    public password!: string;

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
}
