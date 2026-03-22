import {
    IsOptional, IsUUID, IsString, IsEnum, IsDateString, IsNotEmpty, MinLength
} from 'class-validator';
import {
    ApiProperty, ApiPropertyOptional
} from '@nestjs/swagger';
import {TransactionType} from '#generated/prisma/client.js';

export class GetTotalsQueryDto {
    @ApiProperty({description: 'Start of date range (ISO 8601)', example: '2026-01-01T00:00:00.000Z'})
    @IsNotEmpty()
    @IsDateString()
    // required; @IsNotEmpty() rejects empty, @IsDateString() rejects invalid format
    startDate!: string;

    @ApiProperty({description: 'End of date range (ISO 8601)', example: '2026-12-31T23:59:59.999Z'})
    @IsNotEmpty()
    @IsDateString()
    // required; @IsNotEmpty() rejects empty, @IsDateString() rejects invalid format
    endDate!: string;

    @ApiPropertyOptional({description: 'Filter by account UUID'})
    @IsUUID()
    @IsOptional()
    accountId?: string;

    @ApiPropertyOptional({description: 'Filter by category UUID'})
    @IsUUID()
    @IsOptional()
    categoryId?: string;

    @ApiPropertyOptional({description: 'Filter by transaction type', enum: TransactionType})
    @IsEnum(TransactionType)
    @IsOptional()
    transactionType?: TransactionType;

    @ApiPropertyOptional({description: 'Filter by description text (partial match)'})
    @IsString()
    @MinLength(1)
    @IsOptional()
    search?: string;
}
