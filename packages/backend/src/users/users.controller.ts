import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody
} from '@nestjs/swagger';
import {UsersService} from './users.service.js';
import {
    CreateUserDto, UpdateUserDto, UserResponseDto
} from './dto/index.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    /**
     * Register a new user (public endpoint for now)
     * POST /users
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Register a new user', description: 'Create a new user account with email and password'})
    @ApiBody({type: CreateUserDto})
    @ApiResponse({status: 201, description: 'User successfully created', type: UserResponseDto})
    @ApiResponse({status: 409, description: 'Email already exists'})
    @ApiResponse({status: 400, description: 'Invalid input data'})
    public async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
        const user = await this.usersService.create(createUserDto);
        return UserResponseDto.fromEntity(user);
    }

    /**
     * Get user profile by ID
     * GET /users/:id
     */
    @Get(':id')
    @ApiOperation({summary: 'Get user by ID', description: 'Retrieve user profile information by user ID'})
    @ApiParam({name: 'id', description: 'User UUID', type: String})
    @ApiResponse({status: 200, description: 'User found', type: UserResponseDto})
    @ApiResponse({status: 404, description: 'User not found'})
    public async findOne(@Param('id') id: string): Promise<UserResponseDto> {
        const user = await this.usersService.findOne(id);
        return UserResponseDto.fromEntity(user);
    }

    /**
     * Update user information
     * PATCH /users/:id
     */
    @Patch(':id')
    @ApiOperation({summary: 'Update user', description: 'Update user profile information'})
    @ApiParam({name: 'id', description: 'User UUID', type: String})
    @ApiBody({type: UpdateUserDto})
    @ApiResponse({status: 200, description: 'User successfully updated', type: UserResponseDto})
    @ApiResponse({status: 404, description: 'User not found'})
    @ApiResponse({status: 400, description: 'Invalid input data'})
    public async update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto
    ): Promise<UserResponseDto> {
        const user = await this.usersService.update(id, updateUserDto);
        return UserResponseDto.fromEntity(user);
    }

    /**
     * Soft delete user
     * DELETE /users/:id
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({summary: 'Delete user', description: 'Soft delete a user account (sets deletedAt timestamp)'})
    @ApiParam({name: 'id', description: 'User UUID', type: String})
    @ApiResponse({status: 204, description: 'User successfully deleted'})
    @ApiResponse({status: 404, description: 'User not found'})
    public async remove(@Param('id') id: string): Promise<void> {
        await this.usersService.remove(id);
    }
}
