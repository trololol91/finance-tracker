import {
    Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus, UseGuards, ParseUUIDPipe
} from '@nestjs/common';
import {
    ApiTags, ApiOperation, ApiBearerAuth
} from '@nestjs/swagger';
import {ApiTokensService} from '#api-tokens/api-tokens.service.js';
import {CreateApiTokenDto} from '#api-tokens/dto/create-api-token.dto.js';
import type {
    CreateApiTokenResponseDto, ApiTokenResponseDto
} from '#api-tokens/dto/api-token-response.dto.js';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';

@ApiTags('api-tokens')
@Controller('api-tokens')
// Intentionally JwtAuthGuard (not FlexibleAuthGuard): API tokens must not be able to
// create or revoke other API tokens — that would allow privilege escalation via a
// compromised or stolen token. Token management is restricted to browser sessions only.
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ApiTokensController {
    constructor(private readonly apiTokensService: ApiTokensService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Create a new API token'})
    public create(
        @Body() dto: CreateApiTokenDto,
        @CurrentUser() user: User
    ): Promise<CreateApiTokenResponseDto> {
        return this.apiTokensService.create(user.id, user.role, dto);
    }

    @Get()
    @ApiOperation({summary: 'List all API tokens for the current user'})
    public findAll(@CurrentUser() user: User): Promise<ApiTokenResponseDto[]> {
        return this.apiTokensService.findAll(user.id);
    }

    @Delete(':id')
    @HttpCode(204)
    @ApiOperation({summary: 'Revoke an API token'})
    public remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User): Promise<void> {
        return this.apiTokensService.remove(user.id, id);
    }
}
