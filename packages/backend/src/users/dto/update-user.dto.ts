import {
    IsString, IsOptional, IsBoolean, IsIn
} from 'class-validator';

export class UpdateUserDto {
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

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
