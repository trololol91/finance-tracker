import {ApiProperty} from '@nestjs/swagger';
import type {Account} from '#generated/prisma/client.js';
import {AccountType} from '#generated/prisma/client.js';

export class AccountResponseDto {
    @ApiProperty({
        description: 'Account ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    id!: string;

    @ApiProperty({
        description: 'Owning user ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440010'
    })
    userId!: string;

    @ApiProperty({
        description: 'Account name',
        example: 'TD Chequing'
    })
    name!: string;

    @ApiProperty({
        description: 'Account type',
        enum: AccountType,
        example: AccountType.checking
    })
    type!: AccountType;

    @ApiProperty({
        description: 'Financial institution name',
        example: 'TD Bank',
        nullable: true,
        type: String
    })
    institution!: string | null;

    @ApiProperty({
        description: 'ISO 4217 currency code',
        example: 'CAD'
    })
    currency!: string;

    @ApiProperty({
        description: 'Opening balance at the time the account was added',
        example: 1500.00
    })
    openingBalance!: number;

    @ApiProperty({
        description: 'Current balance (openingBalance + all active income − all active expense transactions)',
        example: 2340.50
    })
    currentBalance!: number;

    @ApiProperty({
        description: 'Number of active (non-voided) linked transactions',
        example: 42
    })
    transactionCount!: number;

    @ApiProperty({
        description: 'Hex colour code',
        example: '#4CAF50',
        nullable: true,
        type: String
    })
    color!: string | null;

    @ApiProperty({
        description: 'Optional notes',
        example: 'Primary chequing account',
        nullable: true,
        type: String
    })
    notes!: string | null;

    @ApiProperty({
        description: 'Whether the account is active',
        example: true
    })
    isActive!: boolean;

    @ApiProperty({
        description: 'Record creation timestamp',
        example: '2026-01-15T10:00:00.000Z'
    })
    createdAt!: Date;

    @ApiProperty({
        description: 'Record last updated timestamp',
        example: '2026-01-15T10:00:00.000Z'
    })
    updatedAt!: Date;

    static fromEntity(
        account: Account,
        currentBalance: number,
        transactionCount: number
    ): AccountResponseDto {
        const dto = new AccountResponseDto();
        dto.id = account.id;
        dto.userId = account.userId;
        dto.name = account.name;
        dto.type = account.type;
        dto.institution = account.institution;
        dto.currency = account.currency;
        dto.openingBalance = Number(account.openingBalance);
        dto.currentBalance = currentBalance;
        dto.transactionCount = transactionCount;
        dto.color = account.color;
        dto.notes = account.notes;
        dto.isActive = account.isActive;
        dto.createdAt = account.createdAt;
        dto.updatedAt = account.updatedAt;
        return dto;
    }
}
