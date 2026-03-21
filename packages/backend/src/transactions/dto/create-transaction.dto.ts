import {
    IsNumber,
    IsString,
    IsNotEmpty,
    IsOptional,
    IsUUID,
    IsEnum,
    IsDateString
} from 'class-validator';
import {Type} from 'class-transformer';
import {ApiProperty} from '@nestjs/swagger';
import {TransactionType} from '#generated/prisma/client.js';

export class CreateTransactionDto {
    @ApiProperty({
        description: 'Transaction amount (positive number)',
        example: 42.50,
        type: Number
    })
    @IsNumber({maxDecimalPlaces: 2})
    @Type(() => Number)
    amount!: number;

    @ApiProperty({
        description: 'Transaction description',
        example: 'Starbucks Coffee'
    })
    @IsString()
    @IsNotEmpty()
    description!: string;

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
        description: 'Transaction type',
        enum: TransactionType,
        example: TransactionType.expense
    })
    @IsEnum(TransactionType)
    transactionType!: TransactionType;

    @ApiProperty({
        description: 'Transaction date (ISO 8601)',
        example: '2026-02-25T10:30:00.000Z'
    })
    @IsDateString()
    date!: string;
}
