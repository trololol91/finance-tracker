import {
    IsOptional, IsString, Matches
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class MonthQueryDto {
    @ApiProperty({
        description: 'Month in YYYY-MM format. Defaults to current month.',
        example: '2026-03',
        required: false,
        type: String
    })
    @IsString()
    @IsOptional()
    @Matches(/^\d{4}-\d{2}$/, {message: 'month must be in YYYY-MM format'})
    month?: string;
}
