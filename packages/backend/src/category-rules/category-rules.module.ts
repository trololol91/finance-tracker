import {Module} from '@nestjs/common';
import {DatabaseModule} from '#database/database.module.js';
import {CategoryRulesController} from './category-rules.controller.js';
import {CategoryRulesService} from './category-rules.service.js';

@Module({
    imports: [DatabaseModule],
    controllers: [CategoryRulesController],
    providers: [CategoryRulesService],
    exports: [CategoryRulesService]
})
export class CategoryRulesModule {}
