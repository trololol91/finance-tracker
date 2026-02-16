import {
    IsEmail, IsString, MinLength, IsOptional, IsIn
} from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8)
    password!: string;

    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;

    @IsString()
    @IsOptional()
    timezone?: string;

    @IsString()
    @IsIn(['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD'])
    @IsOptional()
    currency?: string;
}
