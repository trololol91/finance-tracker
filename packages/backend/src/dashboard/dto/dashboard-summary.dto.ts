import {ApiProperty} from '@nestjs/swagger';

export class TransactionSummaryItemDto {
    @ApiProperty({description: 'Transaction ID'})
    id!: string;

    @ApiProperty({description: 'Transaction date as ISO 8601 UTC string'})
    date!: string;

    @ApiProperty({description: 'Transaction description'})
    description!: string;

    @ApiProperty({description: 'Transaction amount'})
    amount!: number;

    @ApiProperty({enum: ['income', 'expense', 'transfer']})
    transactionType!: string;

    @ApiProperty({nullable: true, type: String})
    categoryName!: string | null;

    @ApiProperty({nullable: true, type: String})
    accountName!: string | null;
}

export class AccountBalanceSummaryItemDto {
    @ApiProperty({description: 'Account ID'})
    id!: string;

    @ApiProperty({description: 'Account name'})
    name!: string;

    @ApiProperty({description: 'Account currency'})
    currency!: string;

    @ApiProperty({description: 'Current account balance'})
    balance!: number;
}

export class DashboardSummaryDto {
    @ApiProperty({description: 'Period in YYYY-MM format', example: '2026-03'})
    month!: string;

    @ApiProperty({description: 'Total income for the month', example: 5000.00})
    totalIncome!: number;

    @ApiProperty({description: 'Total expenses for the month', example: 3200.00})
    totalExpenses!: number;

    @ApiProperty({description: 'totalIncome - totalExpenses', example: 1800.00})
    netBalance!: number;

    @ApiProperty({description: 'Count of non-transfer transactions in the period', example: 42})
    transactionCount!: number;

    @ApiProperty({
        description: '(income - expenses) / income * 100; null when income = 0',
        nullable: true,
        type: Number,
        example: 36.0
    })
    savingsRate!: number | null;

    @ApiProperty({type: [AccountBalanceSummaryItemDto]})
    accounts!: AccountBalanceSummaryItemDto[];

    @ApiProperty({type: [TransactionSummaryItemDto], description: 'Last 5 transactions desc by date'})
    recentTransactions!: TransactionSummaryItemDto[];
}
