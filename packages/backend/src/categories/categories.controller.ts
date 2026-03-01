import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    UseGuards,
    Res
} from '@nestjs/common';
import type {Response} from 'express';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody,
    ApiBearerAuth
} from '@nestjs/swagger';
import {CategoriesService} from './categories.service.js';
import {CreateCategoryDto} from './dto/create-category.dto.js';
import {UpdateCategoryDto} from './dto/update-category.dto.js';
import {CategoryResponseDto} from './dto/category-response.dto.js';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';

@ApiTags('categories')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}

    /**
     * List all categories for the authenticated user.
     * GET /categories
     */
    @Get()
    @ApiOperation({
        summary: 'List categories',
        description:
            'Get all categories for the authenticated user, ordered by (parentId nulls first, name). Includes transactionCount. The `children` field is always an empty array on this endpoint — the list is flat by design. Does not filter by isActive.'
    })
    @ApiResponse({status: 200, description: 'List of categories', type: [CategoryResponseDto]})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findAll(@CurrentUser() currentUser: User): Promise<CategoryResponseDto[]> {
        return this.categoriesService.findAll(currentUser.id);
    }

    /**
     * Get a single category by ID.
     * GET /categories/:id
     */
    @Get(':id')
    @ApiOperation({
        summary: 'Get category by ID',
        description:
            'Get a specific category. Returns 404 if not found or belongs to another user.'
    })
    @ApiParam({name: 'id', description: 'Category UUID', type: String})
    @ApiResponse({status: 200, description: 'Category found', type: CategoryResponseDto})
    @ApiResponse({status: 404, description: 'Category not found'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findOne(
        @Param('id') id: string,
        @CurrentUser() currentUser: User
    ): Promise<CategoryResponseDto> {
        return this.categoriesService.findOne(currentUser.id, id);
    }

    /**
     * Create a new category for the authenticated user.
     * POST /categories
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create category',
        description:
            'Create a new category. parentId is optional — omit for a top-level category. Nesting is limited to one level.'
    })
    @ApiBody({type: CreateCategoryDto})
    @ApiResponse({status: 201, description: 'Category created', type: CategoryResponseDto})
    @ApiResponse({status: 400, description: 'Validation error or depth limit exceeded'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Parent category not found'})
    @ApiResponse({status: 409, description: 'Duplicate name at this level'})
    public async create(
        @Body() createDto: CreateCategoryDto,
        @CurrentUser() currentUser: User
    ): Promise<CategoryResponseDto> {
        return this.categoriesService.create(currentUser.id, createDto);
    }

    /**
     * Partially update a category.
     * PATCH /categories/:id
     */
    @Patch(':id')
    @ApiOperation({
        summary: 'Update category',
        description:
            'Partially update a category. Supports renaming, changing colour/icon, reparenting, or toggling isActive.'
    })
    @ApiParam({name: 'id', description: 'Category UUID', type: String})
    @ApiBody({type: UpdateCategoryDto})
    @ApiResponse({status: 200, description: 'Category updated', type: CategoryResponseDto})
    @ApiResponse({status: 400, description: 'Validation error or depth limit exceeded'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Category not found'})
    @ApiResponse({status: 409, description: 'Duplicate name at this level'})
    public async update(
        @Param('id') id: string,
        @Body() updateDto: UpdateCategoryDto,
        @CurrentUser() currentUser: User
    ): Promise<CategoryResponseDto> {
        return this.categoriesService.update(currentUser.id, id, updateDto);
    }

    /**
     * Delete a category (hard or soft depending on usage).
     * DELETE /categories/:id
     */
    @Delete(':id')
    @ApiOperation({
        summary: 'Delete category',
        description:
            'Delete a category. Hard-deletes if no transactions are linked; soft-deletes (isActive=false) if transactions exist. Returns 400 if the category has child categories.'
    })
    @ApiParam({name: 'id', description: 'Category UUID', type: String})
    @ApiResponse({
        status: 204,
        description: 'Category hard-deleted (no transactions, no children)'
    })
    @ApiResponse({
        status: 200,
        description: 'Category soft-deleted (has transactions) — isActive set to false',
        type: CategoryResponseDto
    })
    @ApiResponse({status: 400, description: 'Category has child categories'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Category not found'})
    public async remove(
        @Param('id') id: string,
        @CurrentUser() currentUser: User,
        @Res({passthrough: true}) res: Response
    ): Promise<CategoryResponseDto | void> {
        const result = await this.categoriesService.remove(currentUser.id, id);
        if (result === null) {
            // Hard-deleted — send 204 No Content (NestJS defaults DELETE to 200)
            res.status(HttpStatus.NO_CONTENT);
            return;
        }
        // Soft-deleted — return 200 with DTO
        return result;
    }
}
