import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {renderHook} from '@testing-library/react';
import {useQuery} from '@tanstack/react-query';
import {useAiStatus} from '@features/transactions/hooks/useAiStatus.js';

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn()
}));

vi.mock('@services/api/mutator.js', () => ({
    customInstance: vi.fn()
}));

describe('useAiStatus', () => {

    beforeEach(() => { vi.clearAllMocks(); });

    it('returns available=false and isLoading=true when query is loading', () => {
        vi.mocked(useQuery).mockReturnValue({data: undefined, isLoading: true} as never);
        const {result} = renderHook(() => useAiStatus());
        expect(result.current.available).toBe(false);
        expect(result.current.isLoading).toBe(true);
    });

    it('returns available=true when data.available is true', () => {
        vi.mocked(useQuery).mockReturnValue(
            {data: {available: true, provider: 'anthropic', model: 'claude'}, isLoading: false} as never
        );
        const {result} = renderHook(() => useAiStatus());
        expect(result.current.available).toBe(true);
        expect(result.current.isLoading).toBe(false);
    });

    it('returns available=false when data.available is false', () => {
        vi.mocked(useQuery).mockReturnValue(
            {data: {available: false, provider: 'none', model: ''}, isLoading: false} as never
        );
        const {result} = renderHook(() => useAiStatus());
        expect(result.current.available).toBe(false);
    });

    it('returns available=false when data is undefined', () => {
        vi.mocked(useQuery).mockReturnValue({data: undefined, isLoading: false} as never);
        const {result} = renderHook(() => useAiStatus());
        expect(result.current.available).toBe(false);
    });
});
