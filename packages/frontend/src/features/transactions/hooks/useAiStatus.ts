/**
 * useAiStatus — queries GET /ai-categorization/status to determine whether
 * AI categorization is available on the backend.
 */
import {useAiCategorizationControllerGetStatus} from '@/api/ai-categorization/ai-categorization.js';

interface UseAiStatusReturn {
    available: boolean;
    isLoading: boolean;
}

export const useAiStatus = (): UseAiStatusReturn => {
    const {data, isLoading} = useAiCategorizationControllerGetStatus({
        query: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: false
        }
    });

    return {
        available: data?.available ?? false,
        isLoading
    };
};
