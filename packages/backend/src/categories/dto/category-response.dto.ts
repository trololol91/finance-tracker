import {ApiProperty} from '@nestjs/swagger';
import type {Category} from '#generated/prisma/client.js';

export class CategoryResponseDto {
    @ApiProperty({
        description: 'Category ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    id!: string;

    @ApiProperty({
        description: 'Owning user ID (UUID)',
        example: '550e8400-e29b-41d4-a716-446655440010'
    })
    userId!: string;

    @ApiProperty({
        description: 'Category name',
        example: 'Groceries'
    })
    name!: string;

    @ApiProperty({
        description: 'Optional description',
        example: 'Weekly grocery shopping',
        nullable: true,
        type: String
    })
    description!: string | null;

    @ApiProperty({
        description: 'Hex colour code',
        example: '#4CAF50',
        nullable: true,
        type: String
    })
    color!: string | null;

    @ApiProperty({
        description: 'Icon (emoji or short name)',
        example: '🛒',
        nullable: true,
        type: String
    })
    icon!: string | null;

    @ApiProperty({
        description: 'Parent category ID (UUID), null for top-level categories',
        example: '550e8400-e29b-41d4-a716-446655440001',
        nullable: true,
        type: String
    })
    parentId!: string | null;

    @ApiProperty({
        description: 'Whether the category is active',
        example: true
    })
    isActive!: boolean;

    @ApiProperty({
        description: 'Number of transactions linked to this category (active and inactive)',
        example: 12
    })
    transactionCount!: number;

    @ApiProperty({
        description: 'Child categories (populated on list endpoint)',
        type: () => [CategoryResponseDto]
    })
    children!: CategoryResponseDto[];

    @ApiProperty({
        description: 'Record creation timestamp',
        example: '2026-01-15T10:00:00.000Z'
    })
    createdAt!: Date;

    @ApiProperty({
        description: 'Record last updated timestamp',
        example: '2026-01-15T10:00:00.000Z'
    })
    updatedAt!: Date;

    static fromEntity(
        category: Category,
        transactionCount = 0,
        children: CategoryResponseDto[] = []
    ): CategoryResponseDto {
        const dto = new CategoryResponseDto();
        dto.id = category.id;
        dto.userId = category.userId;
        dto.name = category.name;
        dto.description = category.description;
        dto.color = category.color;
        dto.icon = category.icon;
        dto.parentId = category.parentId;
        dto.isActive = category.isActive;
        dto.transactionCount = transactionCount;
        dto.children = children;
        dto.createdAt = category.createdAt;
        dto.updatedAt = category.updatedAt;
        return dto;
    }
}
