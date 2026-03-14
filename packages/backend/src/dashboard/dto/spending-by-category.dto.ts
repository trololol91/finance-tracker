import {ApiProperty} from '@nestjs/swagger';

export class SpendingByCategoryItemDto {
    @ApiProperty({nullable: true, type: String, description: 'Category ID; null for uncategorised transactions'})
    categoryId!: string | null;

    @ApiProperty({description: '"Uncategorised" when categoryId is null', example: 'Groceries'})
    categoryName!: string;

    @ApiProperty({description: 'Category color hex code', example: '#3B82F6', nullable: true})
    color!: string | null;

    @ApiProperty({description: 'Total amount spent in this category', example: 450.00})
    total!: number;

    @ApiProperty({description: 'Percentage of total monthly expenses, 0-100', example: 14.06})
    percentage!: number;
}

export class SpendingByCategoryDto {
    @ApiProperty({description: 'Period in YYYY-MM format', example: '2026-03'})
    month!: string;

    @ApiProperty({type: [SpendingByCategoryItemDto]})
    items!: SpendingByCategoryItemDto[];
}
