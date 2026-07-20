import {
    IsString, IsNotEmpty, MaxLength, IsArray, ArrayMinSize, IsUrl
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

/**
 * A deliberately small subset of RFC 7591's full client-metadata surface —
 * only what this authorization server actually uses.
 *
 * redirect_uris is restricted to http:/https: via @IsUrl (require_tld: false
 * so http://localhost:9999/callback-style test URIs still pass). This is
 * stricter than redirect_uri elsewhere in this module (authorize-query.dto.ts,
 * consent-decision.dto.ts, which only @IsString/@IsNotEmpty) — those trust an
 * already-registered value; this is the one place a NEW redirect_uri enters
 * the system, so it's the one place a scheme like `javascript:` must be
 * rejected outright. Letting it through here would let a self-chosen
 * redirect_uri execute script in this app's origin when the consent screen's
 * Approve button navigates window.location.href to it.
 */
export class RegisterClientDto {
    @ApiProperty({description: 'Human-readable client name, e.g. "GitHub Copilot"', maxLength: 100})
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    client_name!: string;

    @ApiProperty({type: [String]})
    @IsArray()
    @ArrayMinSize(1)
    @IsUrl({protocols: ['http', 'https'], require_protocol: true, require_tld: false}, {each: true})
    redirect_uris!: string[];
}
