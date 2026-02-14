export const APP_CONSTANTS = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 3000
} as const;

export const TRANSACTION_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense'
} as const;

export const TRANSACTION_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
} as const;
