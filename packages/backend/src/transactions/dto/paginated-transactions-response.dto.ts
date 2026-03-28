import {ApiProperty} from '@nestjs/swagger';
import {TransactionResponseDto} from './transaction-response.dto.js';

export class PaginatedTransactionsResponseDto {
    @ApiProperty({type: () => [TransactionResponseDto]})
    public data!: TransactionResponseDto[];

    @ApiProperty({description: 'Total number of matching transactions', example: 142})
    public total!: number;

    @ApiProperty({description: 'Current page number', example: 1})
    public page!: number;

    @ApiProperty({description: 'Number of results per page', example: 50})
    public limit!: number;
}
