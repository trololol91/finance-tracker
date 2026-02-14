export const validators = {
    email: (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    password: (password: string): {valid: boolean, errors: string[]} => {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    required: (value: unknown): boolean => {
        if (typeof value === 'string') {
            return value.trim().length > 0;
        }
        return value !== null && value !== undefined;
    },

    minLength: (value: string, min: number): boolean => {
        return value.length >= min;
    },

    maxLength: (value: string, max: number): boolean => {
        return value.length <= max;
    },

    isPositive: (value: number): boolean => {
        return value > 0;
    },

    isNumeric: (value: string): boolean => {
        return !isNaN(Number(value)) && !isNaN(parseFloat(value));
    }
} as const;
