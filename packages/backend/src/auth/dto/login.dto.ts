import {
    IsEmail, IsString, MinLength
} from 'class-validator';

/**
 * Data transfer object for user login
 */
export class LoginDto {
    /**
     * User email address
     * @example user@example.com
     */
    @IsEmail()
    public email!: string;

    /**
     * User password (minimum 8 characters)
     * @example StrongPass123!
     */
    @IsString()
    @MinLength(8)
    public password!: string;
}
