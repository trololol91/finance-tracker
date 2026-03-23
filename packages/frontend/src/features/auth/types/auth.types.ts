import type {CreateUserDto} from '@/api/model/createUserDto.js';

// Re-export for consumers that import registration type from this module
export type {CreateUserDto};

/**
 * User shape stored in auth context and localStorage.
 *
 * NOTE: Could be replaced by Orval-generated `UserResponseDto` which has all fields.
 * Difference: UserResponseDto.firstName/lastName are `string | null` (nullable),
 * whereas local User has them as `string`. Replacing requires null-handling
 * throughout AuthContext, authStorage, and test files.
 */
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    timezone: string;
    currency: string;
    isActive: boolean;
    createdAt: string;
    role: 'USER' | 'ADMIN';
    notifyEmail: boolean;
}

export interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    /** Non-null when auth initialisation failed due to a network error (not a 401). */
    authError: string | null;
    setupRequired: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: CreateUserDto) => Promise<void>;
    logout: () => void;
    updateUser: (user: User) => void;
    completeSetup: (data: CreateUserDto) => Promise<void>;
}
