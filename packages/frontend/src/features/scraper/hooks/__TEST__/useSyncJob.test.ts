import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    renderHook, act
} from '@testing-library/react';
import {
    QueryClient, QueryClientProvider
} from '@tanstack/react-query';
import React from 'react';
import {useSyncJob} from '@features/scraper/hooks/useSyncJob.js';

vi.mock('@/api/sync-schedules/sync-schedules.js', () => ({
    useSyncJobControllerRunNow: vi.fn(),
    useSyncJobControllerMfaResponse: vi.fn()
}));

import {
    useSyncJobControllerRunNow,
    useSyncJobControllerMfaResponse
} from '@/api/sync-schedules/sync-schedules.js';

type RunNowReturn = ReturnType<typeof useSyncJobControllerRunNow>;
type MfaReturn = ReturnType<typeof useSyncJobControllerMfaResponse>;

const makeRunNow = (mutate = vi.fn(), isPending = false): RunNowReturn =>
    ({mutate, isPending}) as unknown as RunNowReturn;

const makeMfa = (mutate = vi.fn(), isPending = false): MfaReturn =>
    ({mutate, isPending}) as unknown as MfaReturn;

const mockRunNow = vi.mocked(useSyncJobControllerRunNow);
const mockMfa = vi.mocked(useSyncJobControllerMfaResponse);

const createWrapper = (): (({children}: {children: React.ReactNode}) => React.JSX.Element) => {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return ({children}: {children: React.ReactNode}) =>
        React.createElement(QueryClientProvider, {client: qc}, children);
};

describe('useSyncJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRunNow.mockReturnValue(makeRunNow());
        mockMfa.mockReturnValue(makeMfa());
    });

    describe('initial state', () => {
        it('returns sessionId as null initially', () => {
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            expect(result.current.sessionId).toBeNull();
        });

        it('returns isTriggeringId as null initially', () => {
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            expect(result.current.isTriggeringId).toBeNull();
        });

        it('returns isSubmittingMfa as false initially', () => {
            mockMfa.mockReturnValue(makeMfa(vi.fn(), false));
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            expect(result.current.isSubmittingMfa).toBe(false);
        });
    });

    describe('trigger', () => {
        it('calls runNow mutation with scheduleId', () => {
            const mutate = vi.fn();
            mockRunNow.mockReturnValue(makeRunNow(mutate));
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.trigger('sched-1'); });
            expect(mutate).toHaveBeenCalledWith(
                {id: 'sched-1', data: {startDate: undefined}},
                expect.any(Object)
            );
        });

        it('passes startDate to runNow when provided', () => {
            const mutate = vi.fn();
            mockRunNow.mockReturnValue(makeRunNow(mutate));
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.trigger('sched-1', '2026-01-01'); });
            expect(mutate).toHaveBeenCalledWith(
                {id: 'sched-1', data: {startDate: '2026-01-01'}},
                expect.any(Object)
            );
        });

        it('sets isTriggeringId while triggering', () => {
            const mutate = vi.fn();
            mockRunNow.mockReturnValue(makeRunNow(mutate));
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.trigger('sched-2'); });
            expect(result.current.isTriggeringId).toBe('sched-2');
        });

        it('onSuccess sets sessionId from result', () => {
            let successCallback: ((result: unknown) => void) | undefined;
            const mutate = vi.fn((_args: unknown, options: {onSuccess?: (r: unknown) => void}) => {
                successCallback = options.onSuccess;
            });
            mockRunNow.mockReturnValue(makeRunNow(mutate));

            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.trigger('sched-1'); });
            act(() => { successCallback?.({sessionId: 'sess-abc'}); });
            expect(result.current.sessionId).toBe('sess-abc');
        });

        it('onSuccess clears isTriggeringId', () => {
            let successCallback: ((result: unknown) => void) | undefined;
            const mutate = vi.fn((_args: unknown, options: {onSuccess?: (r: unknown) => void}) => {
                successCallback = options.onSuccess;
            });
            mockRunNow.mockReturnValue(makeRunNow(mutate));

            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.trigger('sched-1'); });
            act(() => { successCallback?.({}); });
            expect(result.current.isTriggeringId).toBeNull();
        });

        it('onError clears isTriggeringId', () => {
            let errorCallback: ((err: unknown) => void) | undefined;
            const mutate = vi.fn((_args: unknown, options: {onError?: (e: unknown) => void}) => {
                errorCallback = options.onError;
            });
            mockRunNow.mockReturnValue(makeRunNow(mutate));

            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.trigger('sched-1'); });
            act(() => { errorCallback?.(new Error('Network error')); });
            expect(result.current.isTriggeringId).toBeNull();
        });
    });

    describe('submitMfa', () => {
        it('calls mfa mutation with scheduleId and code', () => {
            const mutate = vi.fn();
            mockMfa.mockReturnValue(makeMfa(mutate));
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.submitMfa('sched-1', '123456', 'sess-abc'); });
            expect(mutate).toHaveBeenCalledWith(
                {id: 'sched-1', data: {code: '123456'}},
                expect.any(Object)
            );
        });

        it('reflects isSubmittingMfa from mfa mutation isPending', () => {
            mockMfa.mockReturnValue(makeMfa(vi.fn(), true));
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            expect(result.current.isSubmittingMfa).toBe(true);
        });

        it('logs error via mfa onError callback', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const mutate = vi.fn(
                (_args: unknown, cbs: {onError?: (e: unknown) => void}) => {
                    cbs.onError?.(new Error('MFA failed'));
                }
            );
            mockMfa.mockReturnValue(makeMfa(mutate));
            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.submitMfa('sched-1', '000000', 'sess-mfa'); });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('clearSession', () => {
        it('resets sessionId to null', () => {
            let successCallback: ((result: unknown) => void) | undefined;
            const mutate = vi.fn((_args: unknown, options: {onSuccess?: (r: unknown) => void}) => {
                successCallback = options.onSuccess;
            });
            mockRunNow.mockReturnValue(makeRunNow(mutate));

            const {result} = renderHook(() => useSyncJob(), {wrapper: createWrapper()});
            act(() => { result.current.trigger('sched-1'); });
            act(() => { successCallback?.({sessionId: 'sess-xyz'}); });
            expect(result.current.sessionId).toBe('sess-xyz');

            act(() => { result.current.clearSession(); });
            expect(result.current.sessionId).toBeNull();
        });
    });
});
