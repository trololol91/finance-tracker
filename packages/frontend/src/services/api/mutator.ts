/**
 * Orval custom Axios mutator.
 *
 * Orval calls this function for every generated API request. By routing
 * all calls through `apiClient.request()` we get auth token injection,
 * 401 redirect, and any other interceptors for free — with zero duplication.
 */
import type {AxiosRequestConfig} from 'axios';
import {apiClient} from '@services/api/client.js';

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
    return apiClient.request<T>(config);
};

export default customInstance;
