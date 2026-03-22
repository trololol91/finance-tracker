import {
    IsOptional, IsUUID, IsISO8601
} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';

export class BulkCategorizeQueryDto {
    @ApiPropertyOptional({description: 'Filter by account UUID'})
    @IsOptional()
    @IsUUID()
    accountId?: string;

    @ApiPropertyOptional({description: 'ISO 8601 UTC start date', example: '2026-01-01T00:00:00.000Z'})
    @IsOptional()
    @IsISO8601()
    startDate?: string;

    @ApiPropertyOptional({description: 'ISO 8601 UTC end date', example: '2026-12-31T23:59:59.999Z'})
    @IsOptional()
    @IsISO8601()
    endDate?: string;
}
