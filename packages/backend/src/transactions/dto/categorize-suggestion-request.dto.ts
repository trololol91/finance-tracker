import {
    IsString, IsNotEmpty, IsNumber, IsEnum, Min
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {TransactionType} from '#generated/prisma/client.js';

export class CategorizeSuggestionRequestDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description!: string;

    @ApiProperty()
    @IsNumber()
    @Min(0.01)
    amount!: number;

    @ApiProperty({enum: TransactionType})
    @IsEnum(TransactionType)
    transactionType!: TransactionType;
}
