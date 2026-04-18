/**
 * useAiStatus — queries GET /ai-categorization/status to determine whether
 * AI categorization is available on the backend.
 *
 * The endpoint is not yet in the OpenAPI spec so we call it directly via
 * the Orval custom axios mutator which applies auth interceptors.
 */
import {useQuery} from '@tanstack/react-query';
import {customInstance} from '@services/api/mutator.js';

interface AiStatusResponse {
    available: boolean;
    provider: string;
    model: string;
}

interface UseAiStatusReturn {
    available: boolean;
    isLoading: boolean;
}

export const useAiStatus = (): UseAiStatusReturn => {
    const {data, isLoading} = useQuery<AiStatusResponse>({
        queryKey: ['ai-status'],
        queryFn: () => customInstance<AiStatusResponse>({
            url: '/api/ai-categorization/status',
            method: 'GET'
        }),
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: false
    });

    return {
        available: data?.available ?? false,
        isLoading
    };
};
