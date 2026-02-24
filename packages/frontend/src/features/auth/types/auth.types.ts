export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    timezone: string;
    currency: string;
    isActive: boolean;
    createdAt: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    timezone?: string;
    currency?: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: RegisterRequest) => Promise<void>;
    logout: () => void;
    updateUser: (user: User) => void;
}
