import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
    imports: [CommonModule, TransactionsModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
