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
import {useSyncSchedule} from '@features/scraper/hooks/useSyncSchedule.js';
import type {SyncScheduleResponseDto} from '@/api/model/syncScheduleResponseDto.js';
import type {ScraperInfoDto} from '@/api/model/scraperInfoDto.js';

vi.mock('@/api/sync-schedules/sync-schedules.js', () => ({
    useSyncScheduleControllerFindAll: vi.fn(),
    useSyncScheduleControllerCreate: vi.fn(),
    useSyncScheduleControllerUpdate: vi.fn(),
    useSyncScheduleControllerRemove: vi.fn(),
    getSyncScheduleControllerFindAllQueryKey: vi.fn(() => ['/sync-schedules'])
}));

vi.mock('@/api/scrapers/scrapers.js', () => ({
    useScraperControllerListScrapers: vi.fn()
}));

import {
    useSyncScheduleControllerFindAll,
    useSyncScheduleControllerCreate,
    useSyncScheduleControllerUpdate,
    useSyncScheduleControllerRemove
} from '@/api/sync-schedules/sync-schedules.js';
import {useScraperControllerListScrapers} from '@/api/scrapers/scrapers.js';

type FindAllReturn = ReturnType<typeof useSyncScheduleControllerFindAll>;
type CreateReturn = ReturnType<typeof useSyncScheduleControllerCreate>;
type UpdateReturn = ReturnType<typeof useSyncScheduleControllerUpdate>;
type RemoveReturn = ReturnType<typeof useSyncScheduleControllerRemove>;
type ScrapersReturn = ReturnType<typeof useScraperControllerListScrapers>;

const makeFindAll = (schedules: SyncScheduleResponseDto[] = []): FindAllReturn =>
    ({data: schedules, isLoading: false, isError: false}) as unknown as FindAllReturn;

const makeCreate = (mutate = vi.fn(), isPending = false): CreateReturn =>
    ({mutate, isPending}) as unknown as CreateReturn;

const makeUpdate = (mutate = vi.fn(), isPending = false): UpdateReturn =>
    ({mutate, isPending}) as unknown as UpdateReturn;

const makeRemove = (mutate = vi.fn(), isPending = false): RemoveReturn =>
    ({mutate, isPending}) as unknown as RemoveReturn;

const tdScraper: ScraperInfoDto = {
    bankId: 'td',
    displayName: 'TD Bank',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    inputSchema: [
        {key: 'username', label: 'Username', type: 'text', required: true},
        {key: 'password', label: 'Password', type: 'password', required: true}
    ]
};

const makeScrapers = (scrapers: ScraperInfoDto[] = [tdScraper]): ScrapersReturn =>
    ({data: scrapers}) as unknown as ScrapersReturn;

const mockFindAll = vi.mocked(useSyncScheduleControllerFindAll);
const mockCreate = vi.mocked(useSyncScheduleControllerCreate);
const mockUpdate = vi.mocked(useSyncScheduleControllerUpdate);
const mockRemove = vi.mocked(useSyncScheduleControllerRemove);
const mockScrapers = vi.mocked(useScraperControllerListScrapers);

const createWrapper = (): (({children}: {children: React.ReactNode}) => React.JSX.Element) => {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return ({children}: {children: React.ReactNode}) =>
        React.createElement(QueryClientProvider, {client: qc}, children);
};

const fakeEvent = (): React.FormEvent =>
    ({preventDefault: vi.fn()}) as unknown as React.FormEvent;

const makeSchedule = (
    overrides: Partial<SyncScheduleResponseDto> = {}
): SyncScheduleResponseDto => ({
    id: 'sched-1',
    accountId: 'acc-1',
    bankId: 'td',
    displayName: 'TD Chequing',
    cron: '0 8 * * *',
    lookbackDays: 7,
    enabled: true,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    lastRunAt: null,
    lastRunStatus: null,
    lastSuccessfulSyncAt: null,
    autoCategorizeLlm: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

describe('useSyncSchedule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindAll.mockReturnValue(makeFindAll());
        mockCreate.mockReturnValue(makeCreate());
        mockUpdate.mockReturnValue(makeUpdate());
        mockRemove.mockReturnValue(makeRemove());
        mockScrapers.mockReturnValue(makeScrapers());
    });

    describe('initial state', () => {
        it('returns empty schedules list initially', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            expect(result.current.schedules).toEqual([]);
        });

        it('returns modalMode as null initially', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            expect(result.current.modalMode).toBeNull();
        });

        it('passes through isLoading from query', () => {
            mockFindAll.mockReturnValue(
                {data: undefined, isLoading: true, isError: false} as unknown as FindAllReturn
            );
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            expect(result.current.isLoading).toBe(true);
        });

        it('passes through isError from query', () => {
            mockFindAll.mockReturnValue(
                {data: undefined, isLoading: false, isError: true} as unknown as FindAllReturn
            );
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            expect(result.current.isError).toBe(true);
        });
    });

    describe('modal state', () => {
        it('openCreate sets modalMode to "create"', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            expect(result.current.modalMode).toBe('create');
        });

        it('openCreate resets form values', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            expect(result.current.formValues.accountId).toBe('');
            expect(result.current.formValues.bankId).toBe('');
        });

        it('openCreate resets inputs to empty object', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            expect(result.current.formValues.inputs).toEqual({});
        });

        it('openEdit sets modalMode to "edit"', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule()); });
            expect(result.current.modalMode).toBe('edit');
        });

        it('openEdit populates form with schedule values', () => {
            const schedule = makeSchedule({
                accountId: 'acc-2',
                bankId: 'cibc',
                cron: '0 9 * * 1',
                lookbackDays: 14
            });
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(schedule); });
            expect(result.current.formValues.accountId).toBe('acc-2');
            expect(result.current.formValues.bankId).toBe('cibc');
            expect(result.current.formValues.cron).toBe('0 9 * * 1');
            expect(result.current.formValues.lookbackDays).toBe('14');
        });

        it('openEdit sets inputs to empty object (inputs are never sent back from server)', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule()); });
            expect(result.current.formValues.inputs).toEqual({});
        });

        it('openEdit sets editTarget', () => {
            const schedule = makeSchedule({id: 'sched-99'});
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(schedule); });
            expect(result.current.editTarget?.id).toBe('sched-99');
        });

        it('closeModal sets modalMode to null', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.closeModal(); });
            expect(result.current.modalMode).toBeNull();
        });

        it('closeModal clears editTarget', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule()); });
            act(() => { result.current.closeModal(); });
            expect(result.current.editTarget).toBeNull();
        });
    });

    describe('handleFieldChange', () => {
        it('updates a string field', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.handleFieldChange('cron', '0 9 * * *'); });
            expect(result.current.formValues.cron).toBe('0 9 * * *');
        });

        it('updates a boolean field', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.handleFieldChange('enabled', false); });
            expect(result.current.formValues.enabled).toBe(false);
        });

        it('clears error for the changed field', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            // Trigger a validation error first
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.accountId).toBeDefined();
            // Clear by changing the field
            act(() => { result.current.handleFieldChange('accountId', 'acc-1'); });
            expect(result.current.errors.accountId).toBeUndefined();
        });
    });

    describe('handleInputChange', () => {
        it('updates a key inside inputs', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.handleInputChange('username', 'myuser'); });
            expect(result.current.formValues.inputs.username).toBe('myuser');
        });

        it('merges new key into existing inputs', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleInputChange('username', 'myuser');
                result.current.handleInputChange('password', 'mypass');
            });
            expect(result.current.formValues.inputs.username).toBe('myuser');
            expect(result.current.formValues.inputs.password).toBe('mypass');
        });

        it('clears the corresponding inputs.key error', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            // First trigger an input-level validation error by submitting with bankId set
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            // Should have inputs.username error since td has required username field
            expect(result.current.errors['inputs.username']).toBeDefined();
            // Clearing via handleInputChange should remove the error
            act(() => { result.current.handleInputChange('username', 'myuser'); });
            expect(result.current.errors['inputs.username']).toBeUndefined();
        });
    });

    describe('handleSubmit', () => {
        it('shows validation errors when required fields are empty', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.accountId).toBeDefined();
            expect(result.current.errors.bankId).toBeDefined();
        });

        it('shows input validation errors when bankId is set but required inputs are missing', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors['inputs.username']).toBeDefined();
            expect(result.current.errors['inputs.password']).toBeDefined();
        });

        it('validates lookbackDays range (too low)', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'a');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'u');
                result.current.handleInputChange('password', 'p');
                result.current.handleFieldChange('lookbackDays', '0');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.lookbackDays).toBeDefined();
        });

        it('validates lookbackDays range (too high)', () => {
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'a');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'u');
                result.current.handleInputChange('password', 'p');
                result.current.handleFieldChange('lookbackDays', '400');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.lookbackDays).toBeDefined();
        });

        it('calls create mutation when form is valid in create mode', () => {
            const mutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'user123');
                result.current.handleInputChange('password', 'pass123');
                result.current.handleFieldChange('cron', '0 8 * * *');
                result.current.handleFieldChange('lookbackDays', '7');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        accountId: 'acc-1',
                        bankId: 'td',
                        inputs: expect.objectContaining({username: 'user123'})
                    })
                }),
                expect.any(Object)
            );
        });

        it('includes autoCategorizeLlm: false in create payload by default', () => {
            const mutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'user123');
                result.current.handleInputChange('password', 'pass123');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            interface CreateArg {data: Record<string, unknown>}
            const firstArg = mutate.mock.calls[0][0] as CreateArg;
            expect(firstArg.data.autoCategorizeLlm).toBe(false);
        });

        it('includes autoCategorizeLlm: true in create payload when toggled on', () => {
            const mutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'user123');
                result.current.handleInputChange('password', 'pass123');
                result.current.handleFieldChange('autoCategorizeLlm', true);
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            interface CreateArg {data: Record<string, unknown>}
            const firstArg = mutate.mock.calls[0][0] as CreateArg;
            expect(firstArg.data.autoCategorizeLlm).toBe(true);
        });

        it('closes modal via onSuccess callback after create', () => {
            const mutate = vi.fn((_, cbs: {onSuccess: () => void}) => { cbs.onSuccess(); });
            mockCreate.mockReturnValue(makeCreate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'user');
                result.current.handleInputChange('password', 'pass');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.modalMode).toBeNull();
            expect(result.current.editTarget).toBeNull();
        });

        it('shows general error via onError callback after create', () => {
            const mutate = vi.fn(
                (_, cbs: {onError: (e: unknown) => void}) => {
                    cbs.onError({message: 'Cron invalid'});
                }
            );
            mockCreate.mockReturnValue(makeCreate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'user');
                result.current.handleInputChange('password', 'pass');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.general).toBe('Cron invalid');
        });

        it('extracts server message from response.data.message when present', () => {
            const mutate = vi.fn(
                (_, cbs: {onError: (e: unknown) => void}) => {
                    cbs.onError({
                        response: {data: {message: 'Cron expression is invalid'}},
                        message: 'Request failed with status code 400'
                    });
                }
            );
            mockCreate.mockReturnValue(makeCreate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'user');
                result.current.handleInputChange('password', 'pass');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.general).toBe('Cron expression is invalid');
        });

        it('shows fallback general error when onError has no message', () => {
            const mutate = vi.fn(
                (_, cbs: {onError: (e: unknown) => void}) => { cbs.onError({}); }
            );
            mockCreate.mockReturnValue(makeCreate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => {
                result.current.handleFieldChange('accountId', 'acc-1');
                result.current.handleFieldChange('bankId', 'td');
                result.current.handleInputChange('username', 'user');
                result.current.handleInputChange('password', 'pass');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.general).toContain('create');
        });

        it('calls update mutation when form is valid in edit mode', () => {
            const mutate = vi.fn();
            mockUpdate.mockReturnValue(makeUpdate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule({id: 'sched-5'})); });
            act(() => {
                result.current.handleFieldChange('cron', '0 8 * * *');
                result.current.handleFieldChange('lookbackDays', '7');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mutate).toHaveBeenCalledWith(
                expect.objectContaining({id: 'sched-5'}),
                expect.any(Object)
            );
        });

        it('closes modal via onSuccess callback after update', () => {
            const mutate = vi.fn((_, cbs: {onSuccess: () => void}) => { cbs.onSuccess(); });
            mockUpdate.mockReturnValue(makeUpdate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule()); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.modalMode).toBeNull();
        });

        it('includes autoCategorizeLlm in update payload', () => {
            const mutate = vi.fn();
            mockUpdate.mockReturnValue(makeUpdate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule({id: 'sched-u', autoCategorizeLlm: true})); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            interface UpdateArg {id: string, data: Record<string, unknown>}
            const firstArg = mutate.mock.calls[0][0] as UpdateArg;
            expect(firstArg.data.autoCategorizeLlm).toBe(true);
        });

        it('omits inputs from update payload when inputs is empty', () => {
            const mutate = vi.fn();
            mockUpdate.mockReturnValue(makeUpdate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule({id: 'sched-u'})); });
            // Do not call handleInputChange — leave inputs as {}
            act(() => { result.current.handleSubmit(fakeEvent()); });
            interface UpdateArg {id: string, data: Record<string, unknown>}
            const firstArg = mutate.mock.calls[0][0] as UpdateArg;
            expect(firstArg.data).not.toHaveProperty('inputs');
        });

        it('includes inputs in update payload when inputs has values', () => {
            const mutate = vi.fn();
            mockUpdate.mockReturnValue(makeUpdate(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(makeSchedule({id: 'sched-u'})); });
            act(() => {
                result.current.handleInputChange('username', 'newuser');
                result.current.handleInputChange('password', 'newpass');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            interface UpdateArg {id: string, data: {inputs?: Record<string, string>}}
            const firstArg = mutate.mock.calls[0][0] as UpdateArg;
            expect(firstArg.data.inputs).toEqual({username: 'newuser', password: 'newpass'});
        });
    });

    describe('handleDelete', () => {
        it('calls remove mutation with schedule id', () => {
            const mutate = vi.fn();
            mockRemove.mockReturnValue(makeRemove(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.handleDelete('sched-1'); });
            expect(mutate).toHaveBeenCalledWith(
                {id: 'sched-1'},
                expect.any(Object)
            );
        });

        it('logs error via delete onError callback', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const mutate = vi.fn(
                (_, cbs: {onError: (e: unknown) => void}) => {
                    cbs.onError(new Error('delete failed'));
                }
            );
            mockRemove.mockReturnValue(makeRemove(mutate));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            act(() => { result.current.handleDelete('sched-1'); });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('isSubmitting', () => {
        it('reflects create mutation isPending', () => {
            mockCreate.mockReturnValue(makeCreate(vi.fn(), true));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            expect(result.current.isSubmitting).toBe(true);
        });

        it('reflects update mutation isPending', () => {
            mockUpdate.mockReturnValue(makeUpdate(vi.fn(), true));
            const {result} = renderHook(() => useSyncSchedule(), {wrapper: createWrapper()});
            expect(result.current.isSubmitting).toBe(true);
        });
    });
});
