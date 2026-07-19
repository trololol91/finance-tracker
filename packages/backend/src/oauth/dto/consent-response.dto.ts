import {ApiProperty} from '@nestjs/swagger';

export class ConsentResponseDto {
    @ApiProperty({description: 'Where the frontend should navigate the browser next (the client\'s redirect_uri, with ?code=... or ?error=access_denied)'})
    redirectTo!: string;
}
