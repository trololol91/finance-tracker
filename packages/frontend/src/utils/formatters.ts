import { format, parseISO, isValid } from 'date-fns';

export const formatters = {
    currency: (amount: number, currency = 'USD'): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
        }).format(amount);
    },

    date: (date: string | Date, formatStr = 'MMM dd, yyyy'): string => {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return isValid(dateObj) ? format(dateObj, formatStr) : 'Invalid date';
    },

    dateTime: (date: string | Date): string => {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return isValid(dateObj) ? format(dateObj, 'MMM dd, yyyy hh:mm a') : 'Invalid date';
    },

    percentage: (value: number, decimals = 2): string => {
        return `${value.toFixed(decimals)}%`;
    },

    number: (value: number, decimals = 2): string => {
        return value.toFixed(decimals);
    },

    compact: (value: number): string => {
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short',
        }).format(value);
    },
} as const;
