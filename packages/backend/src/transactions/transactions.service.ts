import {Injectable} from '@nestjs/common';

@Injectable()
export class TransactionsService {
    public getAll(): string {
        return 'List of all transactions';
    }
}
