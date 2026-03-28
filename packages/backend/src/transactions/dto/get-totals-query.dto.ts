import {
    IsOptional, IsUUID, IsString, IsEnum, IsDateString, IsNotEmpty, MinLength, IsArray
} from 'class-validator';
import {Transform} from 'class-transformer';
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

    @ApiPropertyOptional({description: 'Filter by account UUIDs (repeat for multiple)', type: [String]})
    @IsArray()
    @IsUUID(4, {each: true})
    @Transform(({value}: {value: unknown}) =>
        (value === undefined ? undefined : Array.isArray(value) ? value : [value])
    )
    @IsOptional()
    accountId?: string[];

    @ApiPropertyOptional({description: 'Filter by category UUIDs (repeat for multiple)', type: [String]})
    @IsArray()
    @IsUUID(4, {each: true})
    @Transform(({value}: {value: unknown}) =>
        (value === undefined ? undefined : Array.isArray(value) ? value : [value])
    )
    @IsOptional()
    categoryId?: string[];

    @ApiPropertyOptional({description: 'Filter by transaction type (repeat for multiple)', enum: TransactionType, isArray: true})
    @IsArray()
    @IsEnum(TransactionType, {each: true})
    @Transform(({value}: {value: unknown}) =>
        (value === undefined ? undefined : Array.isArray(value) ? value : [value])
    )
    @IsOptional()
    transactionType?: TransactionType[];

    @ApiPropertyOptional({description: 'Filter by description text (partial match)'})
    @IsString()
    @MinLength(1)
    @IsOptional()
    search?: string;
}
