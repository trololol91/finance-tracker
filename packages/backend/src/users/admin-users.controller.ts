import {
    Controller, Get, Patch, Param, Body, UseGuards
} from '@nestjs/common';
import {
    ApiBearerAuth, ApiOperation, ApiResponse, ApiTags
} from '@nestjs/swagger';
import {JwtAuthGuard} from '#auth/guards/jwt-auth.guard.js';
import {AdminGuard} from '#common/guards/admin.guard.js';
import {CurrentUser} from '#auth/decorators/current-user.decorator.js';
import type {User} from '#generated/prisma/client.js';
import {UsersService} from './users.service.js';
import {AdminUserListItemDto} from './dto/admin-user-list-item.dto.js';
import {UpdateUserRoleDto} from './dto/update-user-role.dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    @ApiOperation({summary: 'List all users (admin only)'})
    @ApiResponse({status: 200, type: [AdminUserListItemDto]})
    public async findAll(): Promise<AdminUserListItemDto[]> {
        return this.usersService.findAllForAdmin();
    }

    @Patch(':id/role')
    @ApiOperation({summary: 'Update a user\'s role (admin only)'})
    @ApiResponse({status: 200, type: AdminUserListItemDto})
    @ApiResponse({status: 400, description: 'Cannot change your own role'})
    public async updateRole(
        @Param('id') id: string,
        @Body() dto: UpdateUserRoleDto,
        @CurrentUser() currentUser: User
    ): Promise<AdminUserListItemDto> {
        return this.usersService.updateRole(currentUser.id, id, dto.role);
    }
}
