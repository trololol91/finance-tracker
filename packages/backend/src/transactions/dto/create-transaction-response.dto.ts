import {ApiProperty} from '@nestjs/swagger';
import {TransactionResponseDto} from '#transactions/dto/transaction-response.dto.js';

export class CreateTransactionResponseDto {
    @ApiProperty({
        description: 'Whether the transaction was newly created or already existed',
        enum: ['created', 'duplicate'],
        example: 'created'
    })
    status!: 'created' | 'duplicate';

    @ApiProperty({type: TransactionResponseDto})
    transaction!: TransactionResponseDto;
}
