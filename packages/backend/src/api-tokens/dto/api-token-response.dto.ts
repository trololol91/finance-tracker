import {ApiProperty} from '@nestjs/swagger';

export class ApiTokenResponseDto {
    @ApiProperty({description: 'Token UUID'})
    id!: string;

    @ApiProperty({description: 'Human-readable token name'})
    name!: string;

    @ApiProperty({description: 'Granted scopes', type: [String]})
    scopes!: string[];

    @ApiProperty({description: 'Last time this token was used', nullable: true, type: String, format: 'date-time'})
    lastUsedAt!: Date | null;

    @ApiProperty({description: 'Token expiry timestamp, null = never expires', nullable: true, type: String, format: 'date-time'})
    expiresAt!: Date | null;

    @ApiProperty({description: 'Token creation timestamp'})
    createdAt!: Date;
}

export class CreateApiTokenResponseDto extends ApiTokenResponseDto {
    @ApiProperty({description: 'Raw token value — returned ONCE only at creation time'})
    token!: string;
}
