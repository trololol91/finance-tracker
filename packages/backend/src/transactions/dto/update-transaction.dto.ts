import {
    IsNumber,
    IsPositive,
    IsString,
    IsNotEmpty,
    IsOptional,
    IsUUID,
    IsDateString,
    IsBoolean
} from 'class-validator';
import {Type} from 'class-transformer';
import {ApiProperty} from '@nestjs/swagger';

export class UpdateTransactionDto {
    @ApiProperty({
        description: 'Transaction amount (positive number)',
        example: 42.50,
        required: false,
        type: Number
    })
    @IsNumber({maxDecimalPlaces: 2})
    @IsPositive()
    @Type(() => Number)
    @IsOptional()
    amount?: number;

    @ApiProperty({
        description: 'Transaction description',
        example: 'Starbucks Coffee',
        required: false
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    description?: string;

    @ApiProperty({
        description: 'Optional additional notes',
        example: 'Morning coffee with client',
        required: false,
        nullable: true,
        type: String
    })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiProperty({
        description: 'Category ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440000',
        required: false,
        nullable: true,
        type: String
    })
    @IsUUID()
    @IsOptional()
    categoryId?: string;

    @ApiProperty({
        description: 'Account ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440001',
        required: false,
        nullable: true,
        type: String
    })
    @IsUUID()
    @IsOptional()
    accountId?: string;

    @ApiProperty({
        description: 'Transaction date (ISO 8601)',
        example: '2026-02-25T10:30:00.000Z',
        required: false
    })
    @IsDateString()
    @IsOptional()
    date?: string;

    @ApiProperty({
        description: 'Whether the transaction is active',
        example: true,
        required: false
    })
    @IsBoolean()
    @Type(() => Boolean)
    @IsOptional()
    isActive?: boolean;
}
