import {Injectable} from '@nestjs/common';

@Injectable()
export class UsersService {
    public findAll(): string {
        return 'This action returns all users';
    }

    public findOne(id: string): string {
        return `This action returns user with id ${id}`;
    }
}
