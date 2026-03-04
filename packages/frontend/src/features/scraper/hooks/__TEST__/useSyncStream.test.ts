import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    renderHook, act, waitFor
} from '@testing-library/react';
import {
    QueryClient, QueryClientProvider
} from '@tanstack/react-query';
import React from 'react';
import {useSyncStream} from '@features/scraper/hooks/useSyncStream.js';

const createWrapper = (): (({children}: {children: React.ReactNode}) => React.JSX.Element) => {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return ({children}: {children: React.ReactNode}) =>
        React.createElement(QueryClientProvider, {client: qc}, children);
};

const encoder = new TextEncoder();

type MockReadResult = {done: false, value: Uint8Array} | {done: true, value: undefined};

/** Build a mock reader that yields each SSE block then signals done. */
const makeMockReader = (blocks: string[]) => {
    let index = 0;
    return {
        read: vi.fn((): Promise<MockReadResult> => {
            if (index < blocks.length) {
                const encoded = encoder.encode(blocks[index++]);
                return Promise.resolve({done: false as const, value: encoded});
            }
            return Promise.resolve({done: true as const, value: undefined});
        }),
        cancel: vi.fn().mockResolvedValue(undefined)
    };
};

const mockFetch = vi.fn();

beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('useSyncStream', () => {
    describe('when sessionId is null', () => {
        it('starts in idle state', () => {
            const {result} = renderHook(() => useSyncStream(null), {wrapper: createWrapper()});
            expect(result.current.event.status).toBe('idle');
        });

        it('is not connected', () => {
            const {result} = renderHook(() => useSyncStream(null), {wrapper: createWrapper()});
            expect(result.current.isConnected).toBe(false);
        });

        it('has no error', () => {
            const {result} = renderHook(() => useSyncStream(null), {wrapper: createWrapper()});
            expect(result.current.error).toBeNull();
        });

        it('does not call fetch', () => {
            renderHook(() => useSyncStream(null), {wrapper: createWrapper()});
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('when sessionId is provided', () => {
        it('calls fetch with the SSE stream URL containing sessionId', async () => {
            const reader = makeMockReader([]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            renderHook(() => useSyncStream('sess-1'), {wrapper: createWrapper()});

            await waitFor(() => { expect(mockFetch).toHaveBeenCalled(); });

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('sess-1');
            expect(url).toContain('stream');
        });

        it('sends Authorization header with stored token', async () => {
            localStorage.setItem('auth_token', 'my-jwt-token');
            const reader = makeMockReader([]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            renderHook(() => useSyncStream('sess-auth'), {wrapper: createWrapper()});

            await waitFor(() => { expect(mockFetch).toHaveBeenCalled(); });

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer my-jwt-token');
        });

        it('sends Bearer with empty token when nothing stored', async () => {
            const reader = makeMockReader([]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            renderHook(() => useSyncStream('sess-notoken'), {wrapper: createWrapper()});

            await waitFor(() => { expect(mockFetch).toHaveBeenCalled(); });

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer ');
        });

        it('sets error when response is not ok', async () => {
            mockFetch.mockResolvedValue({ok: false, status: 502, body: null});

            const {result} = renderHook(() => useSyncStream('sess-err'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.error).not.toBeNull();
            });
            expect(result.current.error).toContain('502');
        });

        it('sets error when body is null', async () => {
            mockFetch.mockResolvedValue({ok: true, body: null});

            const {result} = renderHook(() => useSyncStream('sess-null'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.error).not.toBeNull();
            });
        });

        it('processes a running event with message (NestJS wire format — no event: line)', async () => {
            // NestJS @Sse() does not emit an `event:` line by default;
            // the status and message live entirely inside the JSON payload.
            const block = 'id:1\ndata:{"status":"logging_in","message":"Fetching rows"}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-run'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.message).toBeDefined();
            }, {timeout: 3000});

            expect(result.current.event.status).toBe('running');
            expect(result.current.event.message).toBe('Fetching rows');
        });

        it('processes a completed event (NestJS wire format — no event: line)', async () => {
            // Matches the exact format emitted by ScraperService.handleResult() and
            // the BUG-004 race-condition replay path in SyncJobController.stream().
            const block =
                'id:1\ndata:{"status":"complete","importedCount":10,"skippedCount":2}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-done'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.status).toBe('completed');
            }, {timeout: 3000});

            expect(result.current.event.importedCount).toBe(10);
        });

        it('processes a failed event (NestJS wire format — no event: line)', async () => {
            const block =
                'id:1\ndata:{"status":"failed","errorMessage":"Auth error"}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-fail'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.status).toBe('failed');
            }, {timeout: 3000});

            expect(result.current.event.errorMessage).toBe('Auth error');
        });

        it('processes an mfa_required event (NestJS wire format — no event: line)', async () => {
            const block =
                'id:1\ndata:{"status":"mfa_required","mfaChallenge":"Enter OTP"}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-mfa'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.status).toBe('mfa_required');
            }, {timeout: 3000});

            expect(result.current.event.mfaChallenge).toBe('Enter OTP');
        });

        it('handles malformed SSE data without crashing', async () => {
            const block = 'data:NOT_JSON\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-bad'), {wrapper: createWrapper()});

            await waitFor(() => { expect(mockFetch).toHaveBeenCalled(); });
            await act(async () => { await new Promise((r) => { setTimeout(r, 100); }); });
            expect(result.current).toBeDefined();
        });

        it('processes a running event WITHOUT a message (message → undefined)', async () => {
            // p.status is present but p.message is absent → message: undefined
            const block = 'data:{"status":"scraping"}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(
                () => useSyncStream('sess-run-nomsg'), {wrapper: createWrapper()}
            );

            // After processing, status is 'running' with message undefined
            // We use a longer timeout since initial state is already running; wait for isConnected
            await waitFor(
                () => { expect(result.current.isConnected).toBe(false); },
                {timeout: 3000}
            );
            // Status is still running but message should be undefined
            expect(result.current.event.message).toBeUndefined();
        });

        it('processes an mfa event WITHOUT mfaChallenge (mfaChallenge → undefined)', async () => {
            const block = 'data:{"status":"mfa_required","prompt":"Enter code"}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(
                () => useSyncStream('sess-mfa-nochallenge'), {wrapper: createWrapper()}
            );

            await waitFor(() => {
                expect(result.current.event.status).toBe('mfa_required');
            }, {timeout: 3000});
            expect(result.current.event.mfaChallenge).toBeUndefined();
        });

        it('processes a complete event WITHOUT counts (counts → undefined)', async () => {
            const block = 'data:{"status":"complete","summary":"done"}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-complete-nocounts'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.status).toBe('completed');
            }, {timeout: 3000});
            expect(result.current.event.importedCount).toBeUndefined();
        });

        it('handles SSE block lines that are neither event: nor data: (unknown fields)', async () => {
            // Line with 'id:' prefix — ignored; status in payload drives parsing
            const block = 'id:123\ndata:{"status":"logging_in","message":"hi"}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-extra-field'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.message).toBe('hi');
            }, {timeout: 3000});
        });

        it('returns null for block with no data field', async () => {
            // no data: line → parseSseBlock returns null → state unchanged
            const block = 'id:1\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-no-data'), {wrapper: createWrapper()});

            await waitFor(() => { expect(mockFetch).toHaveBeenCalled(); });
            await act(async () => { await new Promise((r) => { setTimeout(r, 150); }); });
            // parseSseBlock returns null → no state update beyond the initial 'running'
            expect(result.current.event.status).toBe('running');
        });

        it('sets error when fetch rejects with a generic error', async () => {
            mockFetch.mockRejectedValue(new Error('Network failure'));

            const {result} = renderHook(() => useSyncStream('sess-throw'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.error).not.toBeNull();
            }, {timeout: 3000});
            expect(result.current.error).toContain('Network failure');
        });

        it('sets generic error message when fetch rejects with non-Error', async () => {
            mockFetch.mockRejectedValue({name: 'SomeError'});

            const {result} = renderHook(() => useSyncStream('sess-nomsg'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.error).not.toBeNull();
            }, {timeout: 3000});
            expect(result.current.error).toBe('Stream error');
        });

        it('does not set error when fetch is aborted (AbortError)', async () => {
            const abortError = Object.assign(new Error('aborted'), {name: 'AbortError'});
            mockFetch.mockRejectedValue(abortError);

            const {result} = renderHook(() => useSyncStream('sess-abort'), {wrapper: createWrapper()});

            await waitFor(() => { expect(mockFetch).toHaveBeenCalled(); });
            await act(async () => { await new Promise((r) => { setTimeout(r, 100); }); });
            // AbortError is swallowed — error should remain null
            expect(result.current.error).toBeNull();
        });

        it('skips empty blocks in the SSE stream', async () => {
            // Extra \n\n creates an empty block after split
            const block = 'data:{"status":"scraping","message":"Running"}\n\n\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-empty-block'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.message).toBeDefined();
            }, {timeout: 3000});
            expect(result.current.event.status).toBe('running');
        });

        it('handles failed event with no errorMessage string gracefully', async () => {
            const block = 'data:{"status":"failed","errorMessage":123}\n\n';
            const reader = makeMockReader([block]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result} = renderHook(() => useSyncStream('sess-fail-no-msg'), {wrapper: createWrapper()});

            await waitFor(() => {
                expect(result.current.event.status).toBe('failed');
            }, {timeout: 3000});
            expect(result.current.event.errorMessage).toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('resets to idle state when sessionId changes to null', async () => {
            const reader = makeMockReader([]);
            mockFetch.mockResolvedValue({ok: true, body: {getReader: () => reader}});

            const {result, rerender} = renderHook(
                ({id}: {id: string | null}) => useSyncStream(id),
                {wrapper: createWrapper(), initialProps: {id: 'sess-cleanup'} as {id: string | null}}
            );

            await waitFor(() => { expect(mockFetch).toHaveBeenCalled(); });

            act(() => { rerender({id: null}); });

            await waitFor(() => { expect(result.current.event.status).toBe('idle'); });
        });
    });
});
