import { Controller, Get } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Get()
    getAll(): string {
        return this.transactionsService.getAll();
    }
}
