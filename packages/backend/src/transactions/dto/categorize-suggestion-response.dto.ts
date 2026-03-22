import {ApiProperty} from '@nestjs/swagger';

export class CategorizeSuggestionResponseDto {
    @ApiProperty()
    categoryId!: string;

    @ApiProperty()
    categoryName!: string;
}
