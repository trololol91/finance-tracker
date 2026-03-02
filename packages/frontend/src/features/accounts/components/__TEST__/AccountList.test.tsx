import {
    render, screen, within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {AccountList} from '@features/accounts/components/AccountList.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const makeAccount = (overrides: Partial<AccountResponseDto> = {}): AccountResponseDto => ({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Main Chequing',
    type: 'checking' as AccountResponseDto['type'],
    institution: 'TD Bank',
    currency: 'CAD',
    openingBalance: 1000,
    currentBalance: 1200.50,
    transactionCount: 5,
    color: '#1a73e8',
    notes: null,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides
});

const defaultProps = {
    accounts: [makeAccount()],
    isLoading: false,
    isError: false,
    showInactive: false,
    onEdit: vi.fn(),
    onDelete: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('AccountList', () => {
    describe('loading state', () => {
        it('shows loading message when isLoading is true', () => {
            render(<AccountList {...defaultProps} isLoading={true} accounts={[]} />);
            expect(screen.getByText(/loading accounts/i)).toBeInTheDocument();
        });

        it('loading region has aria-busy', () => {
            const {container} = render(
                <AccountList {...defaultProps} isLoading={true} accounts={[]} />
            );
            expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error message when isError is true', () => {
            render(<AccountList {...defaultProps} isError={true} accounts={[]} />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty message when no accounts', () => {
            render(<AccountList {...defaultProps} accounts={[]} />);
            // showInactive=false so we see the "no active accounts" message
            expect(screen.getByText(/no active accounts/i)).toBeInTheDocument();
        });

        it('shows "create one" message when no active accounts and showInactive is false', () => {
            const inactive = makeAccount({isActive: false});
            render(<AccountList {...defaultProps} accounts={[inactive]} showInactive={false} />);
            expect(screen.getByText(/no active accounts/i)).toBeInTheDocument();
        });
    });

    describe('account table', () => {
        it('renders a table with aria-label', () => {
            render(<AccountList {...defaultProps} />);
            expect(screen.getByRole('table', {name: /accounts/i})).toBeInTheDocument();
        });

        it('renders the account name', () => {
            render(<AccountList {...defaultProps} />);
            expect(screen.getByText('Main Chequing')).toBeInTheDocument();
        });

        it('renders institution column', () => {
            render(<AccountList {...defaultProps} />);
            expect(screen.getByText('TD Bank')).toBeInTheDocument();
        });

        it('renders formatted current balance', () => {
            render(<AccountList {...defaultProps} />);
            expect(screen.getByText(/1,200\.50/)).toBeInTheDocument();
        });

        it('renders transaction count', () => {
            render(<AccountList {...defaultProps} />);
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('renders color swatch when account has a color', () => {
            const {container} = render(<AccountList {...defaultProps} />);
            // Color swatch is an aria-hidden span with inline backgroundColor style
            const swatch = container.querySelector('[aria-hidden="true"][style]');
            expect(swatch).toBeInTheDocument();
        });

        it('does not render color swatch when account color is null', () => {
            const acc = makeAccount({color: null});
            const {container} = render(<AccountList {...defaultProps} accounts={[acc]} />);
            const swatch = container.querySelector('[aria-hidden="true"][style*="background"]');
            expect(swatch).not.toBeInTheDocument();
        });

        it('shows notes icon when account has notes', () => {
            const acc = makeAccount({notes: 'Important note'});
            render(<AccountList {...defaultProps} accounts={[acc]} />);
            expect(screen.getByLabelText(/notes: important note/i)).toBeInTheDocument();
        });

        it('shows dash for null institution', () => {
            const acc = makeAccount({institution: null});
            render(<AccountList {...defaultProps} accounts={[acc]} />);
            expect(screen.getByText('—')).toBeInTheDocument();
        });
    });

    describe('showInactive filter', () => {
        it('hides inactive accounts when showInactive is false', () => {
            const accounts = [
                makeAccount({id: 'acc-1', name: 'Active Account', isActive: true}),
                makeAccount({id: 'acc-2', name: 'Inactive Account', isActive: false})
            ];
            render(<AccountList {...defaultProps} accounts={accounts} showInactive={false} />);
            expect(screen.getByText('Active Account')).toBeInTheDocument();
            expect(screen.queryByText('Inactive Account')).not.toBeInTheDocument();
        });

        it('shows inactive accounts when showInactive is true', () => {
            const accounts = [
                makeAccount({id: 'acc-1', name: 'Active Account', isActive: true}),
                makeAccount({id: 'acc-2', name: 'Inactive Account', isActive: false})
            ];
            render(<AccountList {...defaultProps} accounts={accounts} showInactive={true} />);
            expect(screen.getByText('Active Account')).toBeInTheDocument();
            expect(screen.getByText('Inactive Account')).toBeInTheDocument();
        });

        it('marks inactive row visually', () => {
            const inactive = makeAccount({isActive: false});
            const {container} = render(
                <AccountList {...defaultProps} accounts={[inactive]} showInactive={true} />
            );
            expect(container.querySelector('[class*="rowInactive"]')).toBeInTheDocument();
        });
    });

    describe('actions', () => {
        it('calls onEdit when Edit button is clicked', async () => {
            const onEdit = vi.fn();
            render(<AccountList {...defaultProps} onEdit={onEdit} />);
            await userEvent.click(screen.getByRole('button', {name: /edit/i}));
            expect(onEdit).toHaveBeenCalledOnce();
            expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({id: 'acc-1'}));
        });

        it('calls onDelete when Delete button is clicked (no transactions)', async () => {
            const onDelete = vi.fn();
            const acc = makeAccount({transactionCount: 0});
            render(<AccountList {...defaultProps} accounts={[acc]} onDelete={onDelete} />);
            await userEvent.click(screen.getByRole('button', {name: /delete/i}));
            expect(onDelete).toHaveBeenCalledOnce();
        });

        it('shows "Deactivate" label when account has transactions', () => {
            const acc = makeAccount({transactionCount: 3});
            render(<AccountList {...defaultProps} accounts={[acc]} />);
            expect(screen.getByRole('button', {name: /deactivate/i})).toBeInTheDocument();
        });

        it('shows "Delete" label when account has zero transactions', () => {
            const acc = makeAccount({transactionCount: 0});
            render(<AccountList {...defaultProps} accounts={[acc]} />);
            expect(screen.getByRole('button', {name: /delete/i})).toBeInTheDocument();
        });
    });

    describe('negative balance', () => {
        it('renders negative balance with credit class', () => {
            const acc = makeAccount({currentBalance: -50.00});
            const {container} = render(<AccountList {...defaultProps} accounts={[acc]} />);
            const negSpan = container.querySelector('[class*="negative"]');
            expect(negSpan).toBeInTheDocument();
            expect(negSpan?.textContent).toMatch(/50/);
        });
    });

    describe('accessibility', () => {
        it('table has accessible column headers', () => {
            render(<AccountList {...defaultProps} />);
            const table = screen.getByRole('table');
            const headers = within(table).getAllByRole('columnheader');
            expect(headers.length).toBeGreaterThan(0);
        });
    });
});
