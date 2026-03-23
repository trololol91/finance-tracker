import {
    IsString,
    IsUrl,
    IsNotEmpty,
    ValidateNested,
    IsObject
} from 'class-validator';
import {Type} from 'class-transformer';
import {ApiProperty} from '@nestjs/swagger';

export class PushSubscriptionKeysDto {
    @ApiProperty({description: 'P-256 Diffie-Hellman public key (base64url)', type: 'string'})
    @IsString()
    @IsNotEmpty()
    public p256dh = '';

    @ApiProperty({description: 'Authentication secret (base64url)', type: 'string'})
    @IsString()
    @IsNotEmpty()
    public auth = '';
}

export class SubscribePushDto {
    @ApiProperty({description: 'Push service endpoint URL', type: 'string'})
    @IsString()
    @IsUrl()
    @IsNotEmpty()
    public endpoint = '';

    @ApiProperty({description: 'Encryption keys for the subscription'})
    @IsObject()
    @ValidateNested()
    @Type(() => PushSubscriptionKeysDto)
    public keys: PushSubscriptionKeysDto = new PushSubscriptionKeysDto();
}
