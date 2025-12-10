import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller.js';
import { AppService } from '@/app.service.js';
import { CommonModule } from '@common/common.module.js';
import { TransactionsModule } from '@transactions/transactions.module.js';

@Module({
    imports: [CommonModule, TransactionsModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
