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
