import axios from 'axios';
import type {
    AxiosInstance, AxiosRequestConfig, AxiosResponse
} from 'axios';
import {env} from '@config/env';
import {
    STORAGE_KEYS, APP_ROUTES, API_ROUTES
} from '@config/constants';

/**
 * Calls POST /auth/refresh directly via a bare axios request — never through
 * `this.client`, since that would re-enter this file's own response
 * interceptor and recurse. The httpOnly refresh_token cookie is attached
 * automatically by the browser via withCredentials.
 *
 * Exported so AuthContext can attempt a silent session restore on mount even
 * when no access token is cached in localStorage (e.g. it was cleared
 * independently of the refresh cookie).
 */
export const requestNewAccessToken = async (): Promise<string> => {
    const response = await axios.post<{accessToken: string}>(
        `${env.API_BASE_URL}/api/auth/refresh`,
        undefined,
        {withCredentials: true}
    );
    return response.data.accessToken;
};

/**
 * Endpoints that manage their own 401s (wrong credentials, expired/invalid
 * refresh token) — a 401 from any of these must never trigger the silent
 * refresh-and-retry flow or the auth-expired hard redirect below. Without
 * this, a wrong-password login attempt would trigger a spurious background
 * refresh call before the caller ever sees the error, and could even rotate
 * an unrelated session's refresh token on a shared browser.
 */
const AUTH_FLOW_PATHS: readonly string[] = [
    API_ROUTES.AUTH.LOGIN,
    API_ROUTES.AUTH.REGISTER,
    API_ROUTES.AUTH.SETUP,
    API_ROUTES.AUTH.REFRESH,
    API_ROUTES.AUTH.LOGOUT
];

class ApiClient {
    private client: AxiosInstance;
    // Shared across all concurrent 401s so simultaneous requests trigger one
    // refresh instead of a stampede of POST /auth/refresh calls.
    private refreshPromise: Promise<string> | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: env.API_BASE_URL,
            timeout: env.API_TIMEOUT,
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json'
            },
            // Serialize arrays as repeated params (?a=1&a=2) instead of
            // Axios's default bracket notation (?a[]=1&a[]=2) so NestJS
            // @Query() decorators receive them correctly.
            paramsSerializer: {
                serialize: (params: Record<string, unknown>): string => {
                    const search = new URLSearchParams();
                    for (const [key, val] of Object.entries(params)) {
                        if (val === undefined || val === null) continue;
                        if (Array.isArray(val)) {
                            val.forEach((v: string | number | boolean) => {
                                search.append(key, String(v));
                            });
                        } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                            search.set(key, String(val));
                        }
                        // Objects, Dates, and other non-primitive values are intentionally
                        // dropped. Serialize them before passing as query params if needed.
                    }
                    return search.toString();
                }
            }
        });

        this.setupInterceptors();
    }

    private setupInterceptors(): void {
        // Request interceptor - Add auth token
        this.client.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                // When sending FormData (file uploads), remove the default
                // Content-Type so Axios can set multipart/form-data with the
                // correct boundary automatically.
                if (config.data instanceof FormData) {
                    delete config.headers['Content-Type'];
                }
                return config;
            },
            (error) => {
                return Promise.reject(new Error(String(error)));
            }
        );

        // Response interceptor - Handle errors
        this.client.interceptors.response.use(
            (response) => response,
            async (error: unknown) => {
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    const originalRequest =
                        error.config as (AxiosRequestConfig & {_retry?: boolean}) | undefined;
                    const isAuthFlowCall = AUTH_FLOW_PATHS.some(
                        (path) => originalRequest?.url?.endsWith(path) ?? false
                    );

                    // Login/register/setup/refresh/logout own their 401s — let the
                    // caller handle the rejection directly, no interceptor side effects.
                    // `error` is already an Error (AxiosError) here, so reject with it as-is.
                    if (isAuthFlowCall) {
                        return Promise.reject(error);
                    }

                    if (originalRequest && !originalRequest._retry) {
                        originalRequest._retry = true;
                        try {
                            this.refreshPromise ??= requestNewAccessToken();
                            const newAccessToken = await this.refreshPromise;
                            this.refreshPromise = null;

                            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newAccessToken);
                            originalRequest.headers = {
                                ...originalRequest.headers,
                                Authorization: `Bearer ${newAccessToken}`
                            };
                            return await this.client.request(originalRequest);
                        } catch {
                            this.refreshPromise = null;
                            // Refresh token is also missing/expired — fall through to logout below.
                        }
                    }

                    // Clear auth data and redirect to login, preserving the current
                    // path so the user lands back where they were after logging in.
                    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
                    localStorage.removeItem(STORAGE_KEYS.USER);
                    const returnTo = window.location.pathname + window.location.search;
                    window.location.href = returnTo && returnTo !== APP_ROUTES.LOGIN
                        ? `${APP_ROUTES.LOGIN}?redirect=${encodeURIComponent(returnTo)}`
                        : APP_ROUTES.LOGIN;
                }
                return Promise.reject(new Error(String(error)));
            }
        );
    }

    public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.get(url, config);
        return response.data;
    }

    public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.post(url, data, config);
        return response.data;
    }

    public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.put(url, data, config);
        return response.data;
    }

    public async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.patch(url, data, config);
        return response.data;
    }

    public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.delete(url, config);
        return response.data;
    }

    /**
     * Generic request method used by the Orval-generated API client mutator.
     * Passes any AxiosRequestConfig directly to the underlying axios instance
     * so all interceptors (auth, error handling) are applied automatically.
     */
    public async request<T>(config: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client.request(config);
        return response.data;
    }
}

export const apiClient = new ApiClient();
