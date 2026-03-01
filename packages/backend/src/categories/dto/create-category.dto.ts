import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsUUID,
    MaxLength,
    Matches
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({
        description: 'Category name',
        example: 'Groceries',
        maxLength: 100
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string;

    @ApiProperty({
        description: 'Optional description',
        example: 'Weekly grocery shopping',
        required: false,
        nullable: true,
        type: String,
        maxLength: 255
    })
    @IsString()
    @MaxLength(255)
    @IsOptional()
    description?: string;

    @ApiProperty({
        description: 'Hex colour code (e.g. #FF5733)',
        example: '#4CAF50',
        required: false,
        nullable: true,
        type: String
    })
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, {
        message: 'color must be a valid 6-digit hex colour (e.g. #4CAF50)'
    })
    @IsOptional()
    color?: string;

    @ApiProperty({
        description: 'Icon (emoji or short name)',
        example: '🛒',
        required: false,
        nullable: true,
        type: String,
        maxLength: 10
    })
    @IsString()
    @MaxLength(10)
    @IsOptional()
    icon?: string;

    @ApiProperty({
        description: 'Parent category ID (UUID). Omit for a top-level category.',
        example: '550e8400-e29b-41d4-a716-446655440000',
        required: false,
        nullable: true,
        type: String
    })
    @IsUUID()
    @IsOptional()
    parentId?: string;
}
