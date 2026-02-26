import {ApiProperty} from '@nestjs/swagger';

export class TransactionTotalsResponseDto {
    @ApiProperty({
        description: 'Total income for the period',
        example: 5000.00,
        type: Number
    })
    totalIncome!: number;

    @ApiProperty({
        description: 'Total expenses for the period',
        example: 2350.75,
        type: Number
    })
    totalExpense!: number;

    @ApiProperty({
        description: 'Net total (income minus expenses)',
        example: 2649.25,
        type: Number
    })
    netTotal!: number;

    @ApiProperty({
        description: 'Start of the period (ISO 8601)',
        example: '2026-01-01T00:00:00.000Z'
    })
    startDate!: string;

    @ApiProperty({
        description: 'End of the period (ISO 8601)',
        example: '2026-12-31T23:59:59.999Z'
    })
    endDate!: string;
}
