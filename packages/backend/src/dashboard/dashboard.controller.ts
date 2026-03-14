import {
    Controller, Get, Query, UseGuards
} from '@nestjs/common';
import {
    ApiBearerAuth, ApiOperation, ApiResponse, ApiTags
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';
import {DashboardService} from './dashboard.service.js';
import {MonthQueryDto} from './dto/month-query.dto.js';
import {DashboardSummaryDto} from './dto/dashboard-summary.dto.js';
import {SpendingByCategoryDto} from './dto/spending-by-category.dto.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('summary')
    @ApiOperation({summary: 'Get dashboard summary (net worth, income, expenses, savings rate)'})
    @ApiResponse({status: 200, type: DashboardSummaryDto})
    public async getSummary(
        @CurrentUser() user: User,
        @Query() query: MonthQueryDto
    ): Promise<DashboardSummaryDto> {
        return this.dashboardService.getSummary(user.id, query.month);
    }

    @Get('spending-by-category')
    @ApiOperation({summary: 'Get spending breakdown by category for a given month'})
    @ApiResponse({status: 200, type: SpendingByCategoryDto})
    public async getSpendingByCategory(
        @CurrentUser() user: User,
        @Query() query: MonthQueryDto
    ): Promise<SpendingByCategoryDto> {
        return this.dashboardService.getSpendingByCategory(user.id, query.month);
    }
}
