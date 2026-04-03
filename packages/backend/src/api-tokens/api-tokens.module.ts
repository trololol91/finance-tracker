import {Module} from '@nestjs/common';
import {ApiTokensController} from './api-tokens.controller.js';
import {ApiTokensService} from './api-tokens.service.js';

@Module({
    controllers: [ApiTokensController],
    providers: [ApiTokensService]
})
export class ApiTokensModule {}
