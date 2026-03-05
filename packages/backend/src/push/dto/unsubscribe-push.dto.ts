import {
    IsUrl,
    IsNotEmpty
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

export class UnsubscribePushDto {
    @ApiProperty({description: 'Push service endpoint URL to remove'})
    @IsUrl()
    @IsNotEmpty()
    public endpoint = '';
}
