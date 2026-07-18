export const helpers = {
    sleep: (ms: number): Promise<void> => {
        return new Promise((resolve) => setTimeout(resolve, ms));
    },

    /**
     * Guards against open-redirect: only a same-origin relative path
     * (single leading slash, not `//` or `/\`, and free of control
     * characters) is considered safe to navigate to from a query param or
     * router state. Control characters (tabs, newlines, etc.) are rejected
     * outright — browsers strip them during URL parsing, so a value like
     * "/\t/evil.com" would otherwise pass the leading-slash check here but
     * resolve to a cross-origin "//evil.com" once actually navigated to.
     */
    isSafeRedirectPath: (path: string): boolean => {
        if (!/^\/(?!\/|\\)/.test(path)) return false;
        // eslint-disable-next-line no-control-regex -- rejecting control chars, not matching them
        return !/[\x00-\x1F\x7F]/.test(path);
    },

    debounce: <T extends (...args: unknown[]) => void>(
        func: T,
        wait: number
    ): ((...args: Parameters<T>) => void) => {
        let timeout: ReturnType<typeof setTimeout> | null = null;

        return (...args: Parameters<T>): void => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                func(...args);
            }, wait);
        };
    },

    throttle: <T extends (...args: unknown[]) => void>(
        func: T,
        limit: number
    ): ((...args: Parameters<T>) => void) => {
        let inThrottle = false;

        return (...args: Parameters<T>): void => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    },

    generateId: (): string => {
        return Math.random().toString(36).substring(2, 11);
    },

    capitalize: (str: string): string => {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    truncate: (str: string, length: number): string => {
        return str.length > length ? `${str.substring(0, length)}...` : str;
    },

    groupBy: <T>(array: T[], key: keyof T): Record<string, T[]> => {
        return array.reduce((result, item) => {
            const group = String(item[key]);
            result[group] = result[group] ?? [];
            result[group].push(item);
            return result;
        }, {} as Record<string, T[]>);
    },

    sortBy: <T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] => {
        return [...array].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];

            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
    },

    uniqueBy: <T>(array: T[], key: keyof T): T[] => {
        const seen = new Set();
        return array.filter((item) => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }
} as const;
