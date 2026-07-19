import {
    IsString, IsNotEmpty
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

/**
 * Matches the field names the MCP SDK's exchangeAuthorization() sends
 * (grant_type/client_id/code/code_verifier/redirect_uri, form-urlencoded) —
 * Nest's default body parser handles both form-urlencoded and JSON bodies
 * identically once parsed, so no special content-type handling is needed here.
 */
export class TokenRequestDto {
    // Not @IsIn(['authorization_code']) — an unsupported grant_type must
    // produce the RFC 6749 §5.2 `unsupported_grant_type` error body, checked
    // explicitly in the controller, rather than the validation pipe's
    // generic 400 shape.
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    grant_type!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    redirect_uri!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    client_id!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code_verifier!: string;
}
