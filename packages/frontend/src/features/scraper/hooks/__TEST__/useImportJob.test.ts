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
import {useImportJob} from '@features/scraper/hooks/useImportJob.js';
import type {ImportJobResponseDto} from '@/api/model/importJobResponseDto.js';

vi.mock('@/api/import/import.js', () => ({
    useImportControllerFindAll: vi.fn(),
    useImportControllerUpload: vi.fn(),
    getImportControllerFindAllQueryKey: vi.fn(() => ['/import'])
}));

import {
    useImportControllerFindAll,
    useImportControllerUpload
} from '@/api/import/import.js';

type FindAllReturn = ReturnType<typeof useImportControllerFindAll>;
type UploadReturn = ReturnType<typeof useImportControllerUpload>;

const makeFindAll = (jobs: ImportJobResponseDto[] = []): FindAllReturn =>
    ({data: jobs, isLoading: false, isError: false}) as unknown as FindAllReturn;

const makeUpload = (mutate = vi.fn(), isPending = false): UploadReturn =>
    ({mutate, isPending}) as unknown as UploadReturn;

const mockFindAll = vi.mocked(useImportControllerFindAll);
const mockUpload = vi.mocked(useImportControllerUpload);

const createWrapper = (): (({children}: {children: React.ReactNode}) => React.JSX.Element) => {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return ({children}: {children: React.ReactNode}) =>
        React.createElement(QueryClientProvider, {client: qc}, children);
};

const makeJob = (overrides: Partial<ImportJobResponseDto> = {}): ImportJobResponseDto => ({
    id: 'job-1',
    accountId: null,
    filename: 'test.csv',
    fileType: 'csv',
    status: 'completed',
    rowCount: 10,
    importedCount: 8,
    skippedCount: 2,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

describe('useImportJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindAll.mockReturnValue(makeFindAll());
        mockUpload.mockReturnValue(makeUpload());
    });

    describe('initial state', () => {
        it('returns empty jobs list initially', () => {
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});
            expect(result.current.jobs).toEqual([]);
        });

        it('returns jobs from query', () => {
            const jobs = [makeJob({id: 'j1'}), makeJob({id: 'j2'})];
            mockFindAll.mockReturnValue(makeFindAll(jobs));
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});
            expect(result.current.jobs).toHaveLength(2);
        });

        it('passes through isLoading', () => {
            mockFindAll.mockReturnValue(
                {data: undefined, isLoading: true, isError: false} as unknown as FindAllReturn
            );
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});
            expect(result.current.isLoading).toBe(true);
        });

        it('passes through isError', () => {
            mockFindAll.mockReturnValue(
                {data: undefined, isLoading: false, isError: true} as unknown as FindAllReturn
            );
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});
            expect(result.current.isError).toBe(true);
        });

        it('returns isUploading from mutation isPending', () => {
            mockUpload.mockReturnValue(makeUpload(vi.fn(), true));
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});
            expect(result.current.isUploading).toBe(true);
        });
    });

    describe('upload', () => {
        it('calls upload mutation with file', () => {
            const mutate = vi.fn();
            mockUpload.mockReturnValue(makeUpload(mutate));
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});

            const file = new File(['data'], 'test.csv', {type: 'text/csv'});
            // Start upload but don't await (mutate is mocked and won't resolve)
            act(() => {
                void result.current.upload(file);
            });

            expect(mutate).toHaveBeenCalledWith(
                {data: {file, accountId: undefined}},
                expect.any(Object)
            );
        });

        it('passes accountId when provided', () => {
            const mutate = vi.fn();
            mockUpload.mockReturnValue(makeUpload(mutate));
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});

            const file = new File(['data'], 'test.csv', {type: 'text/csv'});
            act(() => {
                void result.current.upload(file, 'acc-1');
            });

            expect(mutate).toHaveBeenCalledWith(
                {data: {file, accountId: 'acc-1'}},
                expect.any(Object)
            );
        });

        it('passes undefined accountId when empty string given', () => {
            const mutate = vi.fn();
            mockUpload.mockReturnValue(makeUpload(mutate));
            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});

            const file = new File(['data'], 'test.csv', {type: 'text/csv'});
            act(() => {
                void result.current.upload(file, '');
            });

            expect(mutate).toHaveBeenCalledWith(
                {data: {file, accountId: undefined}},
                expect.any(Object)
            );
        });

        it('resolves with the result on success', async () => {
            const job = makeJob();
            let successCallback: ((result: ImportJobResponseDto) => void) | undefined;
            const mutate = vi.fn(
                (_args: unknown, options: {onSuccess?: (r: ImportJobResponseDto) => void}) => {
                    successCallback = options.onSuccess;
                }
            );
            mockUpload.mockReturnValue(makeUpload(mutate));

            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});
            const file = new File(['data'], 'test.csv', {type: 'text/csv'});

            let resolvedJob: ImportJobResponseDto | undefined;
            act(() => {
                void result.current.upload(file).then((j) => { resolvedJob = j; });
            });
            act(() => { successCallback?.(job); });
            // Allow microtasks to flush
            await Promise.resolve();
            expect(resolvedJob).toEqual(job);
        });

        it('rejects with error on failure', async () => {
            let errorCallback: ((err: unknown) => void) | undefined;
            const mutate = vi.fn(
                (_args: unknown, options: {onError?: (e: unknown) => void}) => {
                    errorCallback = options.onError;
                }
            );
            mockUpload.mockReturnValue(makeUpload(mutate));

            const {result} = renderHook(() => useImportJob(), {wrapper: createWrapper()});
            const file = new File(['data'], 'test.csv', {type: 'text/csv'});

            let rejectionError: unknown;
            act(() => {
                result.current.upload(file).catch((e: unknown) => { rejectionError = e; });
            });
            act(() => { errorCallback?.(new Error('Upload failed')); });
            await Promise.resolve();
            expect(rejectionError).toBeInstanceOf(Error);
        });
    });
});
