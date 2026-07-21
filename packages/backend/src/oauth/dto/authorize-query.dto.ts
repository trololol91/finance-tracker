import {
    IsString, IsNotEmpty, IsOptional
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class AuthorizeQueryDto {
    // Not @IsIn(['code']) — an unsupported response_type must produce a
    // redirect-with-error (RFC 6749 §4.1.2.1) once redirect_uri is confirmed
    // registered, not a raw 400 from the validation pipe. The controller
    // checks the value explicitly instead.
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    response_type!: string;

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

    // See response_type above — checked explicitly in the controller so an
    // unsupported method redirects with an error instead of a raw 400.
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code_challenge_method!: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    state?: string;

    // RFC 6749 §3.3 — real clients (Claude confirmed live) send this even
    // though this server always grants the fixed OAUTH_FIXED_SCOPES block
    // regardless of what's requested (see the "Scope grant" design decision
    // in implementation-plan.md). Accepted so the strict whitelist doesn't
    // 400 the request; deliberately not read anywhere in the controller.
    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    scope?: string;

    // RFC 8707 Resource Indicators — real clients (Claude confirmed live)
    // send this to name the protected resource (the MCP server) they're
    // requesting a token for. This backend only ever serves one resource,
    // so there's nothing to disambiguate; accepted so the strict whitelist
    // doesn't 400 the request, not validated against anything.
    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    resource?: string;
}
