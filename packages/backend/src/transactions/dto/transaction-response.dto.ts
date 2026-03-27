import {ApiProperty} from '@nestjs/swagger';
import type {
    Transaction,
    TransactionType,
    TransferDirection
} from '#generated/prisma/client.js';

export class TransactionResponseDto {
    @ApiProperty({
        description: 'Transaction ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    id!: string;

    @ApiProperty({
        description: 'User ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440010'
    })
    userId!: string;

    @ApiProperty({
        description: 'Transaction amount',
        example: 42.50,
        type: Number
    })
    amount!: number;

    @ApiProperty({
        description: 'Transaction description',
        example: 'Starbucks Coffee'
    })
    description!: string;

    @ApiProperty({
        description: 'Additional notes',
        example: 'Morning coffee with client',
        nullable: true,
        type: String
    })
    notes!: string | null;

    @ApiProperty({
        description: 'Category ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440001',
        nullable: true,
        type: String
    })
    categoryId!: string | null;

    @ApiProperty({
        description: 'Account ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440002',
        nullable: true,
        type: String
    })
    accountId!: string | null;

    @ApiProperty({
        description: 'Transaction type',
        example: 'expense'
    })
    transactionType!: TransactionType;

    @ApiProperty({
        description: 'Transaction date',
        example: '2026-02-25T10:30:00.000Z'
    })
    date!: Date;

    @ApiProperty({
        description: 'Original transaction date (from import)',
        example: '2026-02-25T10:30:00.000Z'
    })
    originalDate!: Date;

    @ApiProperty({
        description: 'Whether the transaction is active',
        example: true
    })
    isActive!: boolean;

    @ApiProperty({
        description: 'Whether the transaction is still pending/unsettled',
        example: false
    })
    isPending!: boolean;

    @ApiProperty({
        description: 'Transfer direction (in/out). Only set for transfer transactions.',
        enum: ['in', 'out'],
        nullable: true,
        required: false
    })
    transferDirection!: TransferDirection | null;

    @ApiProperty({
        description: 'Record creation timestamp',
        example: '2026-02-25T10:30:00.000Z'
    })
    createdAt!: Date;

    @ApiProperty({
        description: 'Record last updated timestamp',
        example: '2026-02-25T10:30:00.000Z'
    })
    updatedAt!: Date;

    static fromEntity(transaction: Transaction): TransactionResponseDto {
        const dto = new TransactionResponseDto();
        dto.id = transaction.id;
        dto.userId = transaction.userId;
        dto.amount = transaction.amount.toNumber();
        dto.description = transaction.description;
        dto.notes = transaction.notes;
        dto.categoryId = transaction.categoryId;
        dto.accountId = transaction.accountId;
        dto.transactionType = transaction.transactionType;
        dto.date = transaction.date;
        dto.originalDate = transaction.originalDate;
        dto.isActive = transaction.isActive;
        dto.isPending = transaction.isPending;
        dto.transferDirection = transaction.transferDirection;
        dto.createdAt = transaction.createdAt;
        dto.updatedAt = transaction.updatedAt;
        return dto;
    }
}
