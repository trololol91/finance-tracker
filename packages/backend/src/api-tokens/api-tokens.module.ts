import {Module} from '@nestjs/common';
import {DatabaseModule} from '#database/database.module.js';
import {ApiTokensController} from '#api-tokens/api-tokens.controller.js';
import {ApiTokensService} from '#api-tokens/api-tokens.service.js';

@Module({
    imports: [DatabaseModule],
    controllers: [ApiTokensController],
    providers: [ApiTokensService]
})
export class ApiTokensModule {}
