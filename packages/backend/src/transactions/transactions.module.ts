import {Module} from '@nestjs/common';
import {DatabaseModule} from '#database/database.module.js';
import {CategoriesModule} from '#categories/categories.module.js';
import {CategoryRulesModule} from '#category-rules/category-rules.module.js';
import {TransactionsController} from './transactions.controller.js';
import {TransactionsService} from './transactions.service.js';

@Module({
    imports: [DatabaseModule, CategoriesModule, CategoryRulesModule],
    controllers: [TransactionsController],
    providers: [TransactionsService],
    exports: [TransactionsService]
})
export class TransactionsModule {}
