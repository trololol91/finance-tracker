import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
    findAll(): string {
        return 'This action returns all users';
    }

    findOne(id: string): string {
        return `This action returns user with id ${id}`;
    }
}
