import {
    IsString, IsOptional, IsBoolean, IsIn
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiProperty({
        description: 'User first name',
        example: 'John',
        required: false,
        type: String
    })
    @IsString()
    @IsOptional()
    firstName?: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
        required: false,
        type: String
    })
    @IsString()
    @IsOptional()
    lastName?: string;

    @ApiProperty({
        description: 'User timezone (IANA timezone format)',
        example: 'America/New_York',
        required: false,
        type: String
    })
    @IsString()
    @IsOptional()
    timezone?: string;

    @ApiProperty({
        description: 'User preferred currency',
        example: 'USD',
        enum: ['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD'],
        required: false
    })
    @IsString()
    @IsIn(['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD'])
    @IsOptional()
    currency?: string;

    @ApiProperty({
        description: 'User active status',
        example: true,
        required: false,
        type: Boolean
    })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({
        description: 'Enable push notifications',
        example: true,
        required: false,
        type: Boolean
    })
    @IsBoolean()
    @IsOptional()
    notifyPush?: boolean;

    @ApiProperty({
        description: 'Enable email notifications',
        example: true,
        required: false,
        type: Boolean
    })
    @IsBoolean()
    @IsOptional()
    notifyEmail?: boolean;
}
