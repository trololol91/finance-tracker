import {ApiProperty} from '@nestjs/swagger';
import {
    IsOptional, IsString, IsUUID
} from 'class-validator';

/**
 * Optional body / query params for file upload.
 * The actual file is received via @UploadedFile().
 */
export class UploadImportDto {
    @ApiProperty({
        description: 'Target account UUID (optional). If supplied the imported transactions link to this account.',
        example: '550e8400-e29b-41d4-a716-446655440000',
        required: false,
        nullable: true,
        type: String
    })
    @IsUUID(4)
    @IsString()
    @IsOptional()
    public accountId?: string;
}
