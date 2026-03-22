import {Module} from '@nestjs/common';
import {UsersController} from './users.controller.js';
import {AdminUsersController} from './admin-users.controller.js';
import {UsersService} from './users.service.js';
import {DatabaseModule} from '#database/database.module.js';
import {CategoriesModule} from '#categories/categories.module.js';

@Module({
    imports: [DatabaseModule, CategoriesModule],
    controllers: [UsersController, AdminUsersController],
    providers: [UsersService],
    exports: [UsersService]
})
export class UsersModule {}
