import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
    ParseIntPipe
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody,
    ApiQuery,
    ApiBearerAuth
} from '@nestjs/swagger';
import {TransactionsService} from './transactions.service.js';
import {CreateTransactionDto} from './dto/create-transaction.dto.js';
import {UpdateTransactionDto} from './dto/update-transaction.dto.js';
import {TransactionFilterDto} from './dto/transaction-filter.dto.js';
import {TransactionResponseDto} from './dto/transaction-response.dto.js';
import {TransactionTotalsResponseDto} from './dto/transaction-totals-response.dto.js';
import {CategorizeSuggestionRequestDto} from './dto/categorize-suggestion-request.dto.js';
import {CategorizeSuggestionResponseDto} from './dto/categorize-suggestion-response.dto.js';
import {BulkCategorizeResponseDto} from './dto/bulk-categorize-response.dto.js';
import {BulkCategorizeQueryDto} from './dto/bulk-categorize-query.dto.js';
import {GetTotalsQueryDto} from './dto/get-totals-query.dto.js';
import {PaginatedTransactionsResponseDto} from './dto/paginated-transactions-response.dto.js';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';

@ApiTags('transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    /**
     * Create a new transaction for the authenticated user.
     * POST /transactions
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create transaction',
        description: 'Create a new transaction for the authenticated user. originalDate is set from date and cannot be changed.'
    })
    @ApiBody({type: CreateTransactionDto})
    @ApiResponse({status: 201, description: 'Transaction created', type: TransactionResponseDto})
    @ApiResponse({status: 400, description: 'Invalid input data'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async create(
        @Body() createDto: CreateTransactionDto,
        @CurrentUser() currentUser: User
    ): Promise<TransactionResponseDto> {
        const transaction = await this.transactionsService.create(currentUser.id, createDto);
        return TransactionResponseDto.fromEntity(transaction);
    }

    /**
     * Get AI-suggested category for a transaction.
     * POST /transactions/categorize-suggestion — must be declared before /:id
     */
    @Post('categorize-suggestion')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({summary: 'Get AI-suggested category for a transaction'})
    @ApiBody({type: CategorizeSuggestionRequestDto})
    @ApiResponse({status: 200, type: CategorizeSuggestionResponseDto})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async categorizeSuggestion(
        @Body() dto: CategorizeSuggestionRequestDto,
        @CurrentUser() currentUser: User
    ): Promise<CategorizeSuggestionResponseDto> {
        return this.transactionsService.categorizeSuggestion(currentUser.id, dto);
    }

    /**
     * Auto-categorize all uncategorized transactions using AI.
     * POST /transactions/bulk-categorize — must be declared before /:id
     */
    @Post('bulk-categorize')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({summary: 'Auto-categorize all uncategorized transactions using AI'})
    @ApiResponse({status: 200, type: BulkCategorizeResponseDto})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async bulkCategorize(
        @Query() query: BulkCategorizeQueryDto,
        @CurrentUser() currentUser: User
    ): Promise<BulkCategorizeResponseDto> {
        return this.transactionsService.bulkCategorize(currentUser.id, query);
    }

    /**
     * List transactions for the authenticated user with optional filters.
     * GET /transactions
     */
    @Get()
    @ApiOperation({
        summary: 'List transactions',
        description: 'Get paginated list of transactions for the authenticated user. Defaults to active transactions only.'
    })
    @ApiQuery({name: 'isActive', required: false, enum: ['true', 'false', 'all'], description: 'Filter by active status (default: true)'})
    @ApiQuery({name: 'transactionType', required: false, isArray: true, enum: ['income', 'expense', 'transfer'], description: 'Transaction type(s) (repeat for multiple)'})
    @ApiQuery({name: 'startDate', required: false, description: 'ISO 8601 date string', example: '2026-01-01T00:00:00.000Z'})
    @ApiQuery({name: 'endDate', required: false, description: 'ISO 8601 date string', example: '2026-12-31T23:59:59.999Z'})
    @ApiQuery({name: 'categoryId', required: false, isArray: true, type: String, description: 'Category UUIDs (repeat for multiple)'})
    @ApiQuery({name: 'accountId', required: false, isArray: true, type: String, description: 'Account UUIDs (repeat for multiple)'})
    @ApiQuery({name: 'search', required: false, description: 'Partial match on description'})
    @ApiQuery({name: 'page', required: false, description: 'Page number (default: 1)', example: 1})
    @ApiQuery({name: 'limit', required: false, description: 'Results per page (default: 50, max: 100)', example: 50})
    @ApiQuery({name: 'sortField', required: false, enum: ['date', 'amount', 'description'], description: 'Field to sort by (default: date)'})
    @ApiQuery({name: 'sortDirection', required: false, enum: ['asc', 'desc'], description: 'Sort direction (default: desc)'})
    @ApiResponse({status: 200, description: 'Paginated transaction list', type: PaginatedTransactionsResponseDto})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findAll(
        @Query() filters: TransactionFilterDto,
        @CurrentUser() currentUser: User
    ): Promise<PaginatedTransactionsResponseDto> {
        const result = await this.transactionsService.findAll(currentUser.id, filters);
        return {
            data: result.data.map(t => TransactionResponseDto.fromEntity(t)),
            total: result.total,
            page: result.page,
            limit: result.limit
        };
    }

    /**
     * Get income/expense totals for a custom date range (active transactions only).
     * GET /transactions/totals — must be declared before /:id
     */
    @Get('totals')
    @ApiOperation({
        summary: 'Get totals by date range',
        description: 'Get income, expense, and net totals for a date range. Only active transactions are included. Transfers are excluded from totals.'
    })
    @ApiQuery({name: 'startDate', required: true, description: 'Start of date range (ISO 8601)', example: '2026-01-01T00:00:00.000Z'})
    @ApiQuery({name: 'endDate', required: true, description: 'End of date range (ISO 8601)', example: '2026-12-31T23:59:59.999Z'})
    @ApiQuery({name: 'accountId', required: false, isArray: true, type: String, description: 'Filter by account UUIDs (repeat for multiple)'})
    @ApiQuery({name: 'categoryId', required: false, isArray: true, type: String, description: 'Filter by category UUIDs (repeat for multiple)'})
    @ApiQuery({name: 'transactionType', required: false, isArray: true, enum: ['income', 'expense', 'transfer'], description: 'Filter by transaction type (repeat for multiple)'})
    @ApiQuery({name: 'search', required: false, description: 'Filter by description text (partial match, min 1 char)'})
    @ApiResponse({status: 200, description: 'Transaction totals', type: TransactionTotalsResponseDto})
    @ApiResponse({status: 400, description: 'Invalid date format or filter value'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async getTotals(
        @Query() query: GetTotalsQueryDto,
        @CurrentUser() currentUser: User
    ): Promise<TransactionTotalsResponseDto> {
        return this.transactionsService.getTotals(
            currentUser.id,
            query.startDate,
            query.endDate,
            {
                accountId: query.accountId,
                categoryId: query.categoryId,
                transactionType: query.transactionType,
                search: query.search
            }
        );
    }

    /**
     * Get totals for a specific calendar month.
     * GET /transactions/totals/:year/:month — must be declared before /:id
     */
    @Get('totals/:year/:month')
    @ApiOperation({
        summary: 'Get monthly totals',
        description: 'Convenience endpoint to get income, expense, and net totals for a full calendar month (1-based).'
    })
    @ApiParam({name: 'year', description: 'Year (e.g. 2026)', type: Number, example: 2026})
    @ApiParam({name: 'month', description: 'Month 1–12', type: Number, example: 2})
    @ApiResponse({status: 200, description: 'Monthly transaction totals', type: TransactionTotalsResponseDto})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async getMonthlyTotals(
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number,
        @CurrentUser() currentUser: User
    ): Promise<TransactionTotalsResponseDto> {
        return this.transactionsService.getMonthlyTotals(currentUser.id, year, month);
    }

    /**
     * Get a single transaction by ID.
     * GET /transactions/:id
     */
    @Get(':id')
    @ApiOperation({
        summary: 'Get transaction by ID',
        description: 'Get a specific transaction. Returns 404 if not found or belongs to another user.'
    })
    @ApiParam({name: 'id', description: 'Transaction UUID', type: String})
    @ApiResponse({status: 200, description: 'Transaction found', type: TransactionResponseDto})
    @ApiResponse({status: 404, description: 'Transaction not found'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findOne(
        @Param('id') id: string,
        @CurrentUser() currentUser: User
    ): Promise<TransactionResponseDto> {
        const transaction = await this.transactionsService.findOne(currentUser.id, id);
        return TransactionResponseDto.fromEntity(transaction);
    }

    /**
     * Toggle a transaction's isActive status.
     * PATCH /transactions/:id/toggle-active — declared before /:id to avoid routing ambiguity
     */
    @Patch(':id/toggle-active')
    @ApiOperation({
        summary: 'Toggle active status',
        description: 'Flip the isActive flag on a transaction. Inactive transactions are excluded from totals.'
    })
    @ApiParam({name: 'id', description: 'Transaction UUID', type: String})
    @ApiResponse({status: 200, description: 'Active status toggled', type: TransactionResponseDto})
    @ApiResponse({status: 404, description: 'Transaction not found'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async toggleActive(
        @Param('id') id: string,
        @CurrentUser() currentUser: User
    ): Promise<TransactionResponseDto> {
        const transaction = await this.transactionsService.toggleActive(currentUser.id, id);
        return TransactionResponseDto.fromEntity(transaction);
    }

    /**
     * Update a transaction.
     * PATCH /transactions/:id
     */
    @Patch(':id')
    @ApiOperation({
        summary: 'Update transaction',
        description: 'Partially update a transaction. transactionType cannot be changed. originalDate is never modified.'
    })
    @ApiParam({name: 'id', description: 'Transaction UUID', type: String})
    @ApiBody({type: UpdateTransactionDto})
    @ApiResponse({status: 200, description: 'Transaction updated', type: TransactionResponseDto})
    @ApiResponse({status: 400, description: 'Invalid input data'})
    @ApiResponse({status: 404, description: 'Transaction not found'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async update(
        @Param('id') id: string,
        @Body() updateDto: UpdateTransactionDto,
        @CurrentUser() currentUser: User
    ): Promise<TransactionResponseDto> {
        const transaction = await this.transactionsService.update(currentUser.id, id, updateDto);
        return TransactionResponseDto.fromEntity(transaction);
    }

    /**
     * Permanently delete a transaction.
     * DELETE /transactions/:id
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete transaction',
        description: 'Permanently delete a transaction. This action is irreversible.'
    })
    @ApiParam({name: 'id', description: 'Transaction UUID', type: String})
    @ApiResponse({status: 204, description: 'Transaction deleted'})
    @ApiResponse({status: 404, description: 'Transaction not found'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async remove(
        @Param('id') id: string,
        @CurrentUser() currentUser: User
    ): Promise<void> {
        await this.transactionsService.remove(currentUser.id, id);
    }
}

