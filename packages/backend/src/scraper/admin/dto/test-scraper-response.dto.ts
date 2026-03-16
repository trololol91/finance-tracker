import {ApiProperty} from '@nestjs/swagger';
import type {RawTransaction} from '#scraper/interfaces/bank-scraper.interface.js';

export class TestScraperResponseDto {
    @ApiProperty({
        description: 'The bankId that was tested — echoes the :bankId path parameter',
        example: 'cibc'
    })
    public bankId!: string;

    @ApiProperty({
        description: 'Raw transaction rows returned by the scraper. No deduplication or DB write is performed.',
        type: 'array',
        items: {
            type: 'object',
            required: ['date', 'description', 'amount', 'pending', 'syntheticId'],
            properties: {
                date: {type: 'string', example: '2026-03-01', description: 'ISO 8601 date'},
                description: {type: 'string', example: 'TIM HORTONS #1234'},
                amount: {type: 'number', example: -4.75, description: 'Negative = debit, positive = credit'},
                pending: {type: 'boolean', example: false},
                syntheticId: {type: 'string', example: 'abc123...', description: 'Stable dedup key'}
            }
        }
    })
    public transactions!: RawTransaction[];

    @ApiProperty({
        description: 'Number of transactions returned — convenience field equal to transactions.length',
        example: 1
    })
    public count!: number;
}
