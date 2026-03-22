import {ApiProperty} from '@nestjs/swagger';

export class BulkCategorizeResponseDto {
    @ApiProperty()
    declare categorized: number;

    @ApiProperty()
    declare skipped: number;

    @ApiProperty({description: 'Total uncategorized transactions found before the 200-record cap'})
    declare total: number;

    @ApiProperty({description: 'Number of transactions actually fetched and processed (capped at 200)'})
    declare processed: number;
}
