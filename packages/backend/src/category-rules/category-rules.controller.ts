import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    UseGuards
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody,
    ApiBearerAuth
} from '@nestjs/swagger';
import {CategoryRulesService} from './category-rules.service.js';
import {CreateCategoryRuleDto} from './dto/create-category-rule.dto.js';
import {CategoryRuleResponseDto} from './dto/category-rule-response.dto.js';
import {FlexibleAuthGuard} from '#auth/guards/flexible-auth.guard.js';
import {ScopesGuard} from '#auth/guards/scopes.guard.js';
import {RequireScopes} from '#auth/decorators/require-scopes.decorator.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';

@ApiTags('category-rules')
@ApiBearerAuth('JWT-auth')
@UseGuards(FlexibleAuthGuard, ScopesGuard)
@Controller('category-rules')
export class CategoryRulesController {
    constructor(private readonly categoryRulesService: CategoryRulesService) {}

    @Get()
    @RequireScopes('categories:read')
    @ApiOperation({summary: 'List category rules'})
    @ApiResponse({status: 200, type: [CategoryRuleResponseDto]})
    public async findAll(@CurrentUser() user: User): Promise<CategoryRuleResponseDto[]> {
        return this.categoryRulesService.findAll(user.id);
    }

    @Post()
    @RequireScopes('categories:write')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create category rule',
        description: 'Creates a rule that maps a description pattern to a category. ' +
            'Set applyToExisting=true to immediately back-fill uncategorized transactions.'
    })
    @ApiBody({type: CreateCategoryRuleDto})
    @ApiResponse({status: 201, type: CategoryRuleResponseDto})
    @ApiResponse({status: 404, description: 'Category not found'})
    @ApiResponse({status: 409, description: 'Pattern already exists'})
    public async create(
        @Body() dto: CreateCategoryRuleDto,
        @CurrentUser() user: User
    ): Promise<CategoryRuleResponseDto> {
        return this.categoryRulesService.create(user.id, dto);
    }

    @Delete(':id')
    @RequireScopes('categories:write')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({summary: 'Delete category rule'})
    @ApiParam({name: 'id', type: String})
    @ApiResponse({status: 204, description: 'Rule deleted'})
    @ApiResponse({status: 404, description: 'Rule not found'})
    public async remove(
        @Param('id') id: string,
        @CurrentUser() user: User
    ): Promise<void> {
        return this.categoryRulesService.remove(user.id, id);
    }
}
