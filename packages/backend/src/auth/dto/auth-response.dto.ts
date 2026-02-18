import {ApiProperty} from '@nestjs/swagger';

/**
 * JWT token payload structure
 */
export interface JwtPayload {
    /** User ID */
    sub: string;
    /** User email address */
    email: string;
}

/**
 * Authentication response with access token and user info
 */
export interface AuthResponse {
    /** JWT access token */
    accessToken: string;
    /** User profile information */
    user: {
        /** User ID */
        id: string;
        /** User email */
        email: string;
        /** User first name (nullable) */
        firstName: string | null;
        /** User last name (nullable) */
        lastName: string | null;
    };
}

/**
 * Nested user info in auth response for Swagger documentation
 */
class AuthUserDto {
    @ApiProperty({description: 'User ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000'})
    public id!: string;

    @ApiProperty({description: 'User email address', example: 'user@example.com'})
    public email!: string;

    @ApiProperty({description: 'User first name', example: 'John', nullable: true})
    public firstName!: string | null;

    @ApiProperty({description: 'User last name', example: 'Doe', nullable: true})
    public lastName!: string | null;
}

/**
 * Authentication response DTO for Swagger documentation
 */
export class AuthResponseDto implements AuthResponse {
    @ApiProperty({
        description: 'JWT access token for authenticating subsequent requests',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    })
    public accessToken!: string;

    @ApiProperty({
        description: 'Authenticated user information',
        type: AuthUserDto
    })
    public user!: AuthUserDto;
}
