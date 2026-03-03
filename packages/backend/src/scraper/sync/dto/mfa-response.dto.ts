import {
    IsString,
    IsNotEmpty,
    MaxLength
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

/** Body accepted by POST /sync-schedules/:id/mfa-response. */
export class MfaResponseDto {
    @ApiProperty({
        description: 'The one-time code entered by the user to satisfy the MFA challenge.',
        example: '123456'
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(16)
    public code!: string;
}
