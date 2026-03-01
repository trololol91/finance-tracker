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

export class UpdateAccountDto {
    @ApiProperty({
        description: 'Account name',
        example: 'TD Chequing',
        required: false,
        maxLength: 100
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @IsOptional()
    name?: string;

    @ApiProperty({
        description: 'Account type',
        enum: AccountType,
        required: false,
        example: AccountType.checking
    })
    @IsEnum(AccountType)
    @IsOptional()
    type?: AccountType;

    @ApiProperty({
        description: 'Financial institution name',
        required: false,
        nullable: true,
        type: String,
        maxLength: 100
    })
    @ValidateIf((o: UpdateAccountDto) => o.institution !== null)
    @IsString()
    @MaxLength(100)
    @IsOptional()
    institution?: string | null;

    @ApiProperty({
        description: 'ISO 4217 currency code',
        example: 'CAD',
        required: false
    })
    @IsString()
    @Length(3, 3, {message: 'currency must be a 3-letter ISO 4217 code'})
    @Matches(/^[A-Z]{3}$/, {message: 'currency must be an uppercase ISO 4217 code (e.g. CAD, USD)'})
    @IsOptional()
    currency?: string;

    @ApiProperty({
        description: 'Opening balance',
        example: 1500.00,
        required: false
    })
    @IsNumber({maxDecimalPlaces: 2})
    @Min(-999999999.99)
    @Max(999999999.99)
    @IsOptional()
    openingBalance?: number;

    @ApiProperty({
        description: 'Hex colour code (e.g. #4CAF50)',
        required: false,
        nullable: true,
        type: String
    })
    @ValidateIf((o: UpdateAccountDto) => o.color !== null)
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, {
        message: 'color must be a valid 6-digit hex colour (e.g. #4CAF50)'
    })
    @IsOptional()
    color?: string | null;

    @ApiProperty({
        description: 'Optional notes',
        required: false,
        nullable: true,
        type: String,
        maxLength: 500
    })
    @ValidateIf((o: UpdateAccountDto) => o.notes !== null)
    @IsString()
    @MaxLength(500)
    @IsOptional()
    notes?: string | null;

    @ApiProperty({
        description: 'Whether the account is active',
        required: false
    })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
