import {
    IsEmail, IsString, MinLength, IsOptional, IsIn
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({
        description: 'User email address (must be unique)',
        example: 'user@example.com',
        type: String
    })
    @IsEmail()
    email!: string;

    @ApiProperty({
        description: 'User password (minimum 8 characters)',
        example: 'SecurePassword123!',
        minLength: 8,
        type: String
    })
    @IsString()
    @MinLength(8)
    password!: string;

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
        default: 'UTC',
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
        default: 'USD',
        required: false
    })
    @IsString()
    @IsIn(['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD'])
    @IsOptional()
    currency?: string;
}
