import {
    Controller, Get, Param
} from '@nestjs/common';
import {UsersService} from '@users/users.service.js';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    public findAll(): string {
        return this.usersService.findAll();
    }

    @Get(':id')
    public findOne(@Param('id') id: string): string {
        return this.usersService.findOne(id);
    }
}
