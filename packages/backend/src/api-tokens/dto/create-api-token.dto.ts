import {
    IsString, IsNotEmpty, IsArray, IsIn, IsOptional, IsDateString,
    ArrayMinSize, MaxLength, registerDecorator
} from 'class-validator';
import type {
    ValidationOptions, ValidationArguments
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {API_TOKEN_SCOPES} from '#auth/api-token-scopes.js';
import type {ApiTokenScope} from '#auth/api-token-scopes.js';

const IsFutureDate = (options?: ValidationOptions) =>
    (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'isFutureDate',
            target: object.constructor,
            propertyName,
            options: {message: 'expiresAt must be a future date', ...options},
            validator: {
                validate(value: unknown, _args: ValidationArguments): boolean {
                    if (typeof value !== 'string') return false;
                    // Compare against the start of tomorrow UTC so that today's date is
                    // rejected — a token expiring at midnight tonight would be immediately
                    // invalid when validated by the strategy's expiresAt: {gt: new Date()} check.
                    const now = new Date();
                    const tomorrowUtc = new Date(Date.UTC(
                        now.getUTCFullYear(),
                        now.getUTCMonth(),
                        now.getUTCDate() + 1
                    ));
                    // Parse via Date.UTC to avoid local-time offset on non-UTC servers.
                    const [y, m, d] = value.split('T')[0].split('-').map(Number);
                    const valueUtc = new Date(Date.UTC(y, m - 1, d));
                    return valueUtc >= tomorrowUtc;
                }
            }
        });
    };

export class CreateApiTokenDto {
    @ApiProperty({description: 'Human-readable token name', maxLength: 100})
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string;

    @ApiProperty({description: 'Scopes to grant', type: [String], enum: API_TOKEN_SCOPES})
    @IsArray()
    @ArrayMinSize(1)
    @IsString({each: true})
    @IsIn(API_TOKEN_SCOPES as unknown as string[], {each: true})
    scopes!: ApiTokenScope[];

    @ApiProperty({
        description: 'Expiry date (YYYY-MM-DD). Must be tomorrow or later. Omit for no expiry.',
        required: false
    })
    @IsOptional()
    @IsDateString()
    @IsFutureDate()
    expiresAt?: string;
}
