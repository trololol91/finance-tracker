import {Module} from '@nestjs/common';
import {AccountsController} from './accounts.controller.js';
import {AccountsService} from './accounts.service.js';
import {DatabaseModule} from '#database/database.module.js';

@Module({
    imports: [DatabaseModule],
    controllers: [AccountsController],
    providers: [AccountsService],
    exports: [AccountsService]
})
export class AccountsModule {}
