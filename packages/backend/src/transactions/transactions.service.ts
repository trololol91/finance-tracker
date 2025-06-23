import { Injectable } from '@nestjs/common';

@Injectable()
export class TransactionsService {
    getAll(): string {
        return 'List of all transactions';
    }
}
