import {Module} from '@nestjs/common';
import {DatabaseModule} from '#database/database.module.js';
import {TransactionsController} from './transactions.controller.js';
import {TransactionsService} from './transactions.service.js';

@Module({
    imports: [DatabaseModule],
    controllers: [TransactionsController],
    providers: [TransactionsService],
    exports: [TransactionsService]
})
export class TransactionsModule {}
