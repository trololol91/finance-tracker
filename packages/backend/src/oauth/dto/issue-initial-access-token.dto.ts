import {
    IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min, Max
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class IssueInitialAccessTokenDto {
    @ApiProperty({description: 'Human-readable label, e.g. "GitHub Copilot setup"', maxLength: 100})
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    label!: string;

    @ApiProperty({description: 'Lifetime in hours (default 24)', required: false, minimum: 1, maximum: 720})
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(720)
    expiresInHours?: number;
}
