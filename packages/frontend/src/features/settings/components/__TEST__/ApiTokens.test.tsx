import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {
    render,
    screen,
    waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {ApiTokens} from '@features/settings/components/ApiTokens.js';
import type {ApiTokenResponseDto} from '@/api/api-tokens/api-tokens.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/api/api-tokens/api-tokens.js', () => ({
    useApiTokensControllerFindAll: vi.fn(),
    useApiTokensControllerRemove: vi.fn(),
    getApiTokensControllerFindAllQueryKey: vi.fn(() => ['/api-tokens'])
}));

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({invalidateQueries: vi.fn()}))
}));

vi.mock('@features/settings/components/NewTokenModal.js', () => ({
    NewTokenModal: ({isOpen, onClose}: {
        isOpen: boolean;
        onClose: () => void;
    }): React.JSX.Element => (
        <div data-testid="new-token-modal" data-open={String(isOpen)}>
            <button onClick={onClose}>Close modal</button>
        </div>
    )
}));

import {
    useApiTokensControllerFindAll,
    useApiTokensControllerRemove
} from '@/api/api-tokens/api-tokens.js';

const mockUseFindAll = vi.mocked(useApiTokensControllerFindAll);
const mockUseRemove = vi.mocked(useApiTokensControllerRemove);
const mockRevokeMutate = vi.fn();

const sampleToken: ApiTokenResponseDto = {
    id: 'token-1',
    name: 'My Integration',
    scopes: ['transactions:read', 'accounts:read'],
    lastUsedAt: null,
    expiresAt: null,
    createdAt: '2025-01-15T10:00:00.000Z'
};

const expiredToken: ApiTokenResponseDto = {
    id: 'token-2',
    name: 'Expired Token',
    scopes: ['dashboard:read'],
    lastUsedAt: '2025-02-01T00:00:00.000Z',
    expiresAt: '2024-12-31T23:59:59.999Z',
    createdAt: '2024-01-01T00:00:00.000Z'
};

type FindAllReturn = ReturnType<typeof useApiTokensControllerFindAll>;
type RemoveReturn = ReturnType<typeof useApiTokensControllerRemove>;

const makeFindAll = (overrides: Partial<FindAllReturn> = {}): FindAllReturn =>
    ({data: undefined, isLoading: false, isError: false, ...overrides}) as unknown as FindAllReturn;

const makeRemove = (): RemoveReturn =>
    ({mutate: mockRevokeMutate}) as unknown as RemoveReturn;

const renderApiTokens = (): void => {
    render(<ApiTokens />);
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ApiTokens', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseRemove.mockReturnValue(makeRemove());
    });

    describe('loading state', () => {
        it('shows loading message while fetching', () => {
            mockUseFindAll.mockReturnValue(makeFindAll({isLoading: true}));
            renderApiTokens();
            expect(screen.getByRole('status')).toHaveTextContent(/loading tokens/i);
        });
    });

    describe('error state', () => {
        it('shows error message on fetch failure', () => {
            mockUseFindAll.mockReturnValue(makeFindAll({isError: true}));
            renderApiTokens();
            expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i);
        });
    });

    describe('empty state', () => {
        it('shows empty state message when no tokens exist', () => {
            mockUseFindAll.mockReturnValue(makeFindAll({data: []}));
            renderApiTokens();
            expect(screen.getByText(/no tokens yet/i)).toBeInTheDocument();
        });
    });

    describe('token list', () => {
        beforeEach(() => {
            mockUseFindAll.mockReturnValue(makeFindAll({data: [sampleToken]}));
        });

        it('renders the token name', () => {
            renderApiTokens();
            expect(screen.getByText('My Integration')).toBeInTheDocument();
        });

        it('renders scope badges for the token', () => {
            renderApiTokens();
            expect(screen.getByText('transactions:read')).toBeInTheDocument();
            expect(screen.getByText('accounts:read')).toBeInTheDocument();
        });

        it('renders a revoke button for each token', () => {
            renderApiTokens();
            expect(
                screen.getByRole('button', {name: /revoke token my integration/i})
            ).toBeInTheDocument();
        });

        it('shows last used as "Never" when lastUsedAt is null', () => {
            renderApiTokens();
            expect(screen.getByText(/last used: never/i)).toBeInTheDocument();
        });
    });

    describe('expired token', () => {
        it('shows expiry info for a token that has an expiry date', () => {
            mockUseFindAll.mockReturnValue(makeFindAll({data: [expiredToken]}));
            renderApiTokens();
            expect(screen.getByText(/expires:/i)).toBeInTheDocument();
        });
    });

    describe('revoke', () => {
        it('calls revoke mutation when Revoke button is clicked', async () => {
            mockUseFindAll.mockReturnValue(makeFindAll({data: [sampleToken]}));
            const user = userEvent.setup();
            renderApiTokens();
            await user.click(screen.getByRole('button', {name: /revoke token my integration/i}));
            expect(mockRevokeMutate).toHaveBeenCalledOnce();
            expect(mockRevokeMutate).toHaveBeenCalledWith(
                {id: 'token-1'},
                expect.objectContaining({onSuccess: expect.any(Function)})
            );
        });

        it('shows error banner when revoke mutation fails', async () => {
            mockUseFindAll.mockReturnValue(makeFindAll({data: [sampleToken]}));
            const user = userEvent.setup();
            renderApiTokens();
            await user.click(screen.getByRole('button', {name: /revoke token my integration/i}));
            const callbacks = mockRevokeMutate.mock.calls[0][1] as {
                onError: () => void;
                onSettled: () => void;
            };
            callbacks.onError();
            callbacks.onSettled();
            await waitFor(() => {
                expect(
                    screen.getByRole('alert', {name: undefined})
                ).toHaveTextContent(/failed to revoke token/i);
            });
        });

        it('invokes onSuccess callback after revoke', async () => {
            const mockInvalidate = vi.fn();
            const {useQueryClient} = await import('@tanstack/react-query');
            vi.mocked(useQueryClient).mockReturnValue(
                {invalidateQueries: mockInvalidate} as unknown as ReturnType<typeof useQueryClient>
            );
            mockUseFindAll.mockReturnValue(makeFindAll({data: [sampleToken]}));
            const user = userEvent.setup();
            renderApiTokens();
            await user.click(screen.getByRole('button', {name: /revoke token my integration/i}));
            const callbacks = mockRevokeMutate.mock.calls[0][1] as {
                onSuccess: () => void;
                onSettled: () => void;
            };
            callbacks.onSuccess();
            callbacks.onSettled();
            expect(mockInvalidate).toHaveBeenCalled();
        });
    });

    describe('generate new token button', () => {
        beforeEach(() => {
            mockUseFindAll.mockReturnValue(makeFindAll({data: []}));
        });

        it('renders "Generate new token" button', () => {
            renderApiTokens();
            expect(
                screen.getByRole('button', {name: /generate new token/i})
            ).toBeInTheDocument();
        });

        it('opens the NewTokenModal when button is clicked', async () => {
            const user = userEvent.setup();
            renderApiTokens();
            await user.click(screen.getByRole('button', {name: /generate new token/i}));
            await waitFor(() => {
                expect(screen.getByTestId('new-token-modal')).toHaveAttribute(
                    'data-open',
                    'true'
                );
            });
        });

        it('closes the modal when modal calls onClose', async () => {
            const user = userEvent.setup();
            renderApiTokens();
            await user.click(screen.getByRole('button', {name: /generate new token/i}));
            await user.click(screen.getByRole('button', {name: /close modal/i}));
            await waitFor(() => {
                expect(screen.getByTestId('new-token-modal')).toHaveAttribute(
                    'data-open',
                    'false'
                );
            });
        });
    });

    describe('accessible landmark', () => {
        it('has a section with aria-label "API tokens"', () => {
            mockUseFindAll.mockReturnValue(makeFindAll({data: []}));
            renderApiTokens();
            expect(
                screen.getByRole('region', {name: /api tokens/i})
            ).toBeInTheDocument();
        });
    });
});
