import {ApiProperty} from '@nestjs/swagger';

export class CategoryRuleResponseDto {
    @ApiProperty()
    declare id: string;

    @ApiProperty()
    declare userId: string;

    @ApiProperty({description: 'Case-insensitive substring pattern'})
    declare pattern: string;

    @ApiProperty({description: 'Category UUID assigned when pattern matches'})
    declare categoryId: string;

    @ApiProperty({description: 'Category name for display'})
    declare categoryName: string;

    @ApiProperty()
    declare createdAt: string;
}
