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
import {UsersService} from './users.service.js';
import {
    CreateUserDto, UpdateUserDto, UserResponseDto
} from './dto/index.js';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    /**
     * Register a new user (public endpoint for now)
     * POST /users
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    public async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
        const user = await this.usersService.create(createUserDto);
        return UserResponseDto.fromEntity(user);
    }

    /**
     * Get user profile by ID
     * GET /users/:id
     */
    @Get(':id')
    public async findOne(@Param('id') id: string): Promise<UserResponseDto> {
        const user = await this.usersService.findOne(id);
        return UserResponseDto.fromEntity(user);
    }

    /**
     * Update user information
     * PATCH /users/:id
     */
    @Patch(':id')
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
    public async remove(@Param('id') id: string): Promise<void> {
        await this.usersService.remove(id);
    }
}
