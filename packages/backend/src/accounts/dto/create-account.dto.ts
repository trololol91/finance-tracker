import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsNumber,
    IsBoolean,
    MaxLength,
    Length,
    Min,
    Max,
    Matches,
    ValidateIf
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {AccountType} from '#generated/prisma/client.js';

export class CreateAccountDto {
    @ApiProperty({
        description: 'Account name',
        example: 'TD Chequing',
        maxLength: 100
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string;

    @ApiProperty({
        description: 'Account type',
        enum: AccountType,
        example: AccountType.checking
    })
    @IsEnum(AccountType)
    type!: AccountType;

    @ApiProperty({
        description: 'Financial institution name',
        example: 'TD Bank',
        required: false,
        nullable: true,
        type: String,
        maxLength: 100
    })
    @ValidateIf((o: CreateAccountDto) => o.institution !== null)
    @IsString()
    @MaxLength(100)
    @IsOptional()
    institution?: string | null;

    @ApiProperty({
        description: 'ISO 4217 currency code',
        example: 'CAD',
        required: false,
        default: 'CAD'
    })
    @IsString()
    @Length(3, 3, {message: 'currency must be a 3-letter ISO 4217 code'})
    @IsOptional()
    currency?: string;

    @ApiProperty({
        description: 'Opening balance at the time the account was added (positive or negative)',
        example: 1500.00,
        required: false,
        default: 0
    })
    @IsNumber({maxDecimalPlaces: 2})
    @Min(-999999999.99)
    @Max(999999999.99)
    @IsOptional()
    openingBalance?: number;

    @ApiProperty({
        description: 'Hex colour code for UI display (e.g. #4CAF50)',
        example: '#4CAF50',
        required: false,
        nullable: true,
        type: String
    })
    @ValidateIf((o: CreateAccountDto) => o.color !== null)
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, {
        message: 'color must be a valid 6-digit hex colour (e.g. #4CAF50)'
    })
    @IsOptional()
    color?: string | null;

    @ApiProperty({
        description: 'Optional notes',
        example: 'Primary chequing account',
        required: false,
        nullable: true,
        type: String,
        maxLength: 500
    })
    @ValidateIf((o: CreateAccountDto) => o.notes !== null)
    @IsString()
    @MaxLength(500)
    @IsOptional()
    notes?: string | null;

    @ApiProperty({
        description: 'Whether the account is active (default: true)',
        required: false,
        default: true
    })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
