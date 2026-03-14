import {IsEnum} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {UserRole} from '#generated/prisma/enums.js';

export class UpdateUserRoleDto {
    @ApiProperty({enum: UserRole, example: UserRole.ADMIN})
    @IsEnum(UserRole)
    role!: UserRole;
}
