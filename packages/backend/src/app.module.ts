import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {AppController} from './app.controller.js';
import {AppService} from './app.service.js';
import {CommonModule} from '#common/common.module.js';
import {DatabaseModule} from '#database/database.module.js';
import {TransactionsModule} from '#transactions/transactions.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env'
        }),
        DatabaseModule,
        CommonModule,
        TransactionsModule
    ],
    controllers: [AppController],
    providers: [AppService]
})
export class AppModule {}
