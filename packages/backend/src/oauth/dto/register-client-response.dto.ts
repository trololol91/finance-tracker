import {ApiProperty} from '@nestjs/swagger';

/**
 * RFC 7591 §3.2.1 shape. No client_secret — public client + mandatory
 * PKCE, same as the static Phase 1 client.
 */
export class RegisterClientResponseDto {
    @ApiProperty()
    client_id!: string;

    @ApiProperty()
    client_name!: string;

    @ApiProperty({type: [String]})
    redirect_uris!: string[];

    @ApiProperty()
    token_endpoint_auth_method!: string;

    @ApiProperty({type: [String]})
    grant_types!: string[];

    @ApiProperty({type: [String]})
    response_types!: string[];
}
