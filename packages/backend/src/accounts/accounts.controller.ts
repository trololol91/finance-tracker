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
import {AccountsService} from './accounts.service.js';
import {CreateAccountDto} from './dto/create-account.dto.js';
import {UpdateAccountDto} from './dto/update-account.dto.js';
import {AccountResponseDto} from './dto/account-response.dto.js';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';

@ApiTags('accounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) {}

    /**
     * List all accounts for the authenticated user.
     * GET /accounts
     */
    @Get()
    @ApiOperation({
        summary: 'List accounts',
        description:
            'Get all accounts for the authenticated user, ordered by name. Each account includes computed currentBalance and transactionCount.'
    })
    @ApiResponse({status: 200, description: 'List of accounts', type: [AccountResponseDto]})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findAll(@CurrentUser() currentUser: User): Promise<AccountResponseDto[]> {
        return this.accountsService.findAll(currentUser.id);
    }

    /**
     * Get a single account by ID.
     * GET /accounts/:id
     */
    @Get(':id')
    @ApiOperation({
        summary: 'Get account by ID',
        description: 'Get a specific account. Returns 404 if not found or belongs to another user.'
    })
    @ApiParam({name: 'id', description: 'Account UUID', type: String})
    @ApiResponse({status: 200, description: 'Account found', type: AccountResponseDto})
    @ApiResponse({status: 404, description: 'Account not found'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async findOne(
        @Param('id') id: string,
        @CurrentUser() currentUser: User
    ): Promise<AccountResponseDto> {
        return this.accountsService.findOne(currentUser.id, id);
    }

    /**
     * Create a new account for the authenticated user.
     * POST /accounts
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create account',
        description:
            'Create a new account. currency defaults to "CAD", openingBalance defaults to 0, isActive defaults to true.'
    })
    @ApiBody({type: CreateAccountDto})
    @ApiResponse({status: 201, description: 'Account created', type: AccountResponseDto})
    @ApiResponse({status: 400, description: 'Validation error'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 409, description: 'Duplicate account name'})
    public async create(
        @Body() createDto: CreateAccountDto,
        @CurrentUser() currentUser: User
    ): Promise<AccountResponseDto> {
        return this.accountsService.create(currentUser.id, createDto);
    }

    /**
     * Partially update an account.
     * PATCH /accounts/:id
     */
    @Patch(':id')
    @ApiOperation({
        summary: 'Update account',
        description:
            'Partially update an account. Supports renaming, changing type, toggling isActive, updating openingBalance, etc.'
    })
    @ApiParam({name: 'id', description: 'Account UUID', type: String})
    @ApiBody({type: UpdateAccountDto})
    @ApiResponse({status: 200, description: 'Account updated', type: AccountResponseDto})
    @ApiResponse({status: 400, description: 'Validation error'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Account not found'})
    @ApiResponse({status: 409, description: 'Duplicate account name'})
    public async update(
        @Param('id') id: string,
        @Body() updateDto: UpdateAccountDto,
        @CurrentUser() currentUser: User
    ): Promise<AccountResponseDto> {
        return this.accountsService.update(currentUser.id, id, updateDto);
    }

    /**
     * Delete an account.
     * Hard-deletes if no transactions are linked; soft-deletes otherwise.
     * DELETE /accounts/:id
     */
    @Delete(':id')
    @ApiOperation({
        summary: 'Delete account',
        description:
            'Delete an account. Hard-deletes (204) if no transactions are linked; soft-deletes (200, isActive=false) if transactions exist. Transactions retain their accountId reference after soft-delete.'
    })
    @ApiParam({name: 'id', description: 'Account UUID', type: String})
    @ApiResponse({
        status: 204,
        description: 'Account hard-deleted (no linked transactions)'
    })
    @ApiResponse({
        status: 200,
        description: 'Account soft-deleted (has transactions) — isActive set to false',
        type: AccountResponseDto
    })
    @ApiResponse({status: 401, description: 'Unauthorized'})
    @ApiResponse({status: 404, description: 'Account not found'})
    public async remove(
        @Param('id') id: string,
        @CurrentUser() currentUser: User,
        @Res({passthrough: true}) res: Response
    ): Promise<AccountResponseDto | void> {
        const result = await this.accountsService.remove(currentUser.id, id);
        if (result === null) {
            res.status(HttpStatus.NO_CONTENT);
            return;
        }
        return result;
    }
}
