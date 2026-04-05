import {
    Controller, Get, Patch, Param, Body, UseGuards, ParseUUIDPipe
} from '@nestjs/common';
import {
    ApiBearerAuth, ApiOperation, ApiResponse, ApiTags
} from '@nestjs/swagger';
import {FlexibleAuthGuard} from '#auth/guards/flexible-auth.guard.js';
import {ScopesGuard} from '#auth/guards/scopes.guard.js';
import {RequireScopes} from '#auth/decorators/require-scopes.decorator.js';
import {AdminGuard} from '#common/guards/admin.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';
import {UsersService} from '#users/users.service.js';
import {AdminUserListItemDto} from '#users/dto/admin-user-list-item.dto.js';
import {UpdateUserRoleDto} from '#users/dto/update-user-role.dto.js';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(FlexibleAuthGuard, ScopesGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    @RequireScopes('admin')
    @ApiOperation({summary: 'List all users (admin only)'})
    @ApiResponse({status: 200, type: [AdminUserListItemDto]})
    public async findAll(): Promise<AdminUserListItemDto[]> {
        return this.usersService.findAllForAdmin();
    }

    @Patch(':id/role')
    @RequireScopes('admin')
    @ApiOperation({summary: 'Update a user\'s role (admin only)'})
    @ApiResponse({status: 200, type: AdminUserListItemDto})
    @ApiResponse({status: 400, description: 'Cannot change your own role'})
    public async updateRole(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserRoleDto,
        @CurrentUser() currentUser: User
    ): Promise<AdminUserListItemDto> {
        return this.usersService.updateRole(currentUser.id, id, dto.role);
    }
}
