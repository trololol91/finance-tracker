import axios from 'axios';
import type {
    AxiosInstance, AxiosRequestConfig, AxiosResponse
} from 'axios';
import {env} from '@config/env';
import {STORAGE_KEYS} from '@config/constants';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: env.API_BASE_URL,
            timeout: env.API_TIMEOUT,
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
            (error) => {
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    // Clear auth data and redirect to login
                    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
                    localStorage.removeItem(STORAGE_KEYS.USER);
                    window.location.href = '/login';
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
