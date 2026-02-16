import {
    Controller, Get
} from '@nestjs/common';
import {TransactionsService} from './transactions.service.js';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Get()
    public getAll(): string {
        return this.transactionsService.getAll();
    }
}
