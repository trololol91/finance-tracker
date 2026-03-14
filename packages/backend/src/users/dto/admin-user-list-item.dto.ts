import {ApiProperty} from '@nestjs/swagger';
import {UserRole} from '#generated/prisma/enums.js';

export class AdminUserListItemDto {
    @ApiProperty({example: 'uuid'})
    id!: string;

    @ApiProperty({example: 'john@example.com'})
    email!: string;

    @ApiProperty({example: 'John', nullable: true})
    firstName!: string | null;

    @ApiProperty({example: 'Doe', nullable: true})
    lastName!: string | null;

    @ApiProperty({enum: UserRole, example: UserRole.USER})
    role!: UserRole;

    @ApiProperty({example: true})
    isActive!: boolean;

    @ApiProperty({example: '2026-01-01T00:00:00Z'})
    createdAt!: Date;
}
