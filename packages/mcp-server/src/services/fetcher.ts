import {AsyncLocalStorage} from 'async_hooks';

export const tokenStorage = new AsyncLocalStorage<string>();

export interface McpFetcherOptions {
    url: string;
    method: string;
    headers?: Record<string, string>;
    params?: Record<string, string | number | boolean | null | undefined | string[]>;
    data?: unknown;
    signal?: AbortSignal;
}

export const mcpFetcher = async <T>(options: McpFetcherOptions): Promise<T> => {
    const token = tokenStorage.getStore();
    if (!token) {
        throw new Error(
            'No API token in context — wrap call with tokenStorage.run(token, fn)'
        );
    }

    const baseUrl = process.env.FINANCE_TRACKER_URL ?? 'http://localhost:3001';

    const url = new URL(options.url, baseUrl);
    if (options.params) {
        for (const [key, value] of Object.entries(options.params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    url.searchParams.append(key, item);
                }
            } else {
                url.searchParams.set(key, String(value));
            }
        }
    }

    const response = await fetch(url.toString(), {
        method: options.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        },
        body: options.data !== undefined ? JSON.stringify(options.data) : undefined,
        signal: options.signal
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
            `API request failed: ${response.status} ${response.statusText}` +
            (text ? ` — ${text}` : '')
        );
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
};
