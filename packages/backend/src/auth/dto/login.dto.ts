import {
    IsEmail, IsString, MinLength, IsOptional, IsBoolean
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

    /**
     * Keep the session signed in across browser restarts via a persistent refresh cookie.
     * Defaults to false (session-only) when omitted.
     * @example true
     */
    @ApiProperty({
        description: 'Keep the session signed in across browser restarts',
        example: true,
        required: false,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    public rememberMe?: boolean;
}
