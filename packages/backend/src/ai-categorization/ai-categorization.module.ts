import {
    Global, Module
} from '@nestjs/common';
import {AiCategorizationService} from './ai-categorization.service.js';
import {AiCategorizationController} from './ai-categorization.controller.js';

// Global so TransactionsModule and ScraperModule can inject AiCategorizationService
// without explicit imports
@Global()
@Module({
    controllers: [AiCategorizationController],
    providers: [AiCategorizationService],
    exports: [AiCategorizationService]
})
export class AiCategorizationModule {}
