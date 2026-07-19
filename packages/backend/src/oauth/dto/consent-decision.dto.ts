import {
    IsIn, IsString, IsNotEmpty, IsOptional, IsBoolean
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

/**
 * Body the frontend consent screen POSTs back — the same authorize params it
 * read off its own URL, plus the user's approve/deny decision. The
 * controller re-validates client_id/redirect_uri server-side rather than
 * trusting these values just because the SPA echoed them back.
 */
export class ConsentDecisionDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    client_id!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    redirect_uri!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code_challenge!: string;

    @ApiProperty({enum: ['S256']})
    @IsIn(['S256'])
    code_challenge_method!: 'S256';

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    state?: string;

    @ApiProperty()
    @IsBoolean()
    approved!: boolean;
}
