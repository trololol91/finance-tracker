import {
    IsString, IsNotEmpty, IsArray, IsIn, IsOptional, IsDateString
} from 'class-validator';
import {API_TOKEN_SCOPES} from '#auth/api-token-scopes.js';
import type {ApiTokenScope} from '#auth/api-token-scopes.js';

export class CreateApiTokenDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsArray()
    @IsIn(API_TOKEN_SCOPES as unknown as string[], {each: true})
    scopes!: ApiTokenScope[];

    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}
