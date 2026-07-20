import {ApiProperty} from '@nestjs/swagger';

export class InitialAccessTokenResponseDto {
    @ApiProperty({description: 'Raw token value — returned ONCE only, hand it to the registering client\'s setup flow'})
    token!: string;

    @ApiProperty()
    label!: string;

    @ApiProperty({description: 'Expiry timestamp — the token stays valid for repeat registrations until then'})
    expiresAt!: Date;
}
