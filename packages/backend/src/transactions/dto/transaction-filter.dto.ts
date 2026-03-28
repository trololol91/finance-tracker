import {
    IsOptional,
    IsUUID,
    IsEnum,
    IsIn,
    IsInt,
    Min,
    Max,
    MinLength,
    IsDateString,
    IsString
} from 'class-validator';
import {Type} from 'class-transformer';
import {ApiProperty} from '@nestjs/swagger';
import {TransactionType} from '#generated/prisma/client.js';

export class TransactionFilterDto {
    @ApiProperty({
        description: 'Filter transactions on or after this date (ISO 8601)',
        example: '2026-01-01T00:00:00.000Z',
        required: false
    })
    @IsDateString()
    @IsOptional()
    startDate?: string;

    @ApiProperty({
        description: 'Filter transactions on or before this date (ISO 8601)',
        example: '2026-12-31T23:59:59.999Z',
        required: false
    })
    @IsDateString()
    @IsOptional()
    endDate?: string;

    @ApiProperty({
        description: 'Filter by category ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440000',
        required: false,
        type: String
    })
    @IsUUID()
    @IsOptional()
    categoryId?: string;

    @ApiProperty({
        description: 'Filter by account ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440001',
        required: false,
        type: String
    })
    @IsUUID()
    @IsOptional()
    accountId?: string;

    @ApiProperty({
        description: 'Filter by transaction type',
        enum: TransactionType,
        example: TransactionType.expense,
        required: false
    })
    @IsEnum(TransactionType)
    @IsOptional()
    transactionType?: TransactionType;

    @ApiProperty({
        description: 'Filter by active status: "true", "false", or "all"',
        enum: ['true', 'false', 'all'],
        example: 'true',
        required: false,
        default: 'true'
    })
    @IsIn(['true', 'false', 'all'])
    @IsString()
    @IsOptional()
    isActive?: 'true' | 'false' | 'all' = 'true';

    @ApiProperty({
        description: 'Filter by description text (partial match)',
        example: 'Starbucks',
        required: false
    })
    @IsString()
    @MinLength(1)
    @IsOptional()
    search?: string;

    @ApiProperty({
        description: 'Field to sort by',
        enum: ['date', 'amount', 'description'],
        example: 'date',
        required: false,
        default: 'date'
    })
    @IsIn(['date', 'amount', 'description'])
    @IsString()
    @IsOptional()
    sortField?: 'date' | 'amount' | 'description' = 'date';

    @ApiProperty({
        description: 'Sort direction',
        enum: ['asc', 'desc'],
        example: 'desc',
        required: false,
        default: 'desc'
    })
    @IsIn(['asc', 'desc'])
    @IsString()
    @IsOptional()
    sortDirection?: 'asc' | 'desc' = 'desc';

    @ApiProperty({
        description: 'Page number (1-based)',
        example: 1,
        required: false,
        default: 1,
        minimum: 1
    })
    @IsInt()
    @Min(1)
    @Type(() => Number)
    @IsOptional()
    page?: number = 1;

    @ApiProperty({
        description: 'Number of results per page',
        example: 50,
        required: false,
        default: 50,
        minimum: 1,
        maximum: 100
    })
    @IsInt()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    @IsOptional()
    limit?: number = 50;
}
