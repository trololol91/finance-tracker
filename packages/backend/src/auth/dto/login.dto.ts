import {
    IsEmail, IsString, MinLength
} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';

/**
 * Data transfer object for user login
 */
export class LoginDto {
    /**
     * User email address
     * @example user@example.com
     */
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com'
    })
    @IsEmail()
    public email!: string;

    /**
     * User password (minimum 8 characters)
     * @example StrongPass123!
     */
    @ApiProperty({
        description: 'User password (minimum 8 characters)',
        example: 'StrongPass123!',
        minLength: 8
    })
    @IsString()
    @MinLength(8)
    public password!: string;
}
