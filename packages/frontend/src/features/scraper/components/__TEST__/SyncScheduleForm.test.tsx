import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SyncScheduleForm} from '@features/scraper/components/SyncScheduleForm.js';
import type {
    SyncScheduleFormValues, SyncScheduleFormErrors
} from '@features/scraper/types/scraper.types.js';

vi.mock('@/api/scrapers/scrapers.js', () => ({
    useScraperControllerListScrapers: vi.fn()
}));
vi.mock('@/api/accounts/accounts.js', () => ({
    useAccountsControllerFindAll: vi.fn()
}));

import {useScraperControllerListScrapers} from '@/api/scrapers/scrapers.js';
import {useAccountsControllerFindAll} from '@/api/accounts/accounts.js';

const mockScrapers = vi.mocked(useScraperControllerListScrapers);
const mockAccounts = vi.mocked(useAccountsControllerFindAll);

interface ScraperItem {bankId: string, displayName: string, isActive: boolean}
interface AccountItem {id: string, name: string, isActive: boolean}

const emptyValues: SyncScheduleFormValues = {
    accountId: '',
    bankId: '',
    username: '',
    password: '',
    cron: '0 8 * * *',
    lookbackDays: '3',
    enabled: true
};

const defaultProps = {
    values: emptyValues,
    errors: {} as SyncScheduleFormErrors,
    isSubmitting: false,
    editMode: false,
    onChange: vi.fn(),
    onSubmit: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
    mockScrapers.mockReturnValue({
        data: [
            {bankId: 'td', displayName: 'TD Bank', isActive: true} as ScraperItem
        ]
    } as ReturnType<typeof useScraperControllerListScrapers>);
    mockAccounts.mockReturnValue({
        data: [
            {id: 'acc-1', name: 'Chequing', isActive: true} as AccountItem
        ]
    } as ReturnType<typeof useAccountsControllerFindAll>);
});

describe('SyncScheduleForm', () => {
    describe('create mode', () => {
        it('renders form with "New sync schedule form" aria-label', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('form', {name: /new sync schedule form/i})).toBeInTheDocument();
        });

        it('shows Account, Bank, Username, Password fields', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/bank/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        });

        it('shows cron and lookback fields', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByLabelText(/schedule.*cron/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/lookback days/i)).toBeInTheDocument();
        });

        it('shows "Create Schedule" submit button in create mode', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('button', {name: /create schedule/i})).toBeInTheDocument();
        });

        it('does not show enabled checkbox in create mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={false} />);
            expect(screen.queryByLabelText(/schedule enabled/i)).not.toBeInTheDocument();
        });

        it('renders available scraper banks as options', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('option', {name: 'TD Bank'})).toBeInTheDocument();
        });

        it('renders active accounts as options', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('option', {name: 'Chequing'})).toBeInTheDocument();
        });

        it('calls onChange when username input changes', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(<SyncScheduleForm {...defaultProps} onChange={onChange} />);
            await user.type(screen.getByLabelText(/^username/i), 'bob');
            expect(onChange).toHaveBeenCalledWith('username', expect.any(String));
        });
    });

    describe('edit mode', () => {
        it('renders form with "Edit sync schedule form" aria-label', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByRole('form', {name: /edit sync schedule form/i})).toBeInTheDocument();
        });

        it('shows "Save Changes" submit button in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('shows "New Username" label in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByLabelText(/new username/i)).toBeInTheDocument();
        });

        it('shows enabled checkbox in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByLabelText(/schedule enabled/i)).toBeInTheDocument();
        });

        it('disables account and bank selects in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByLabelText(/account/i)).toBeDisabled();
            expect(screen.getByLabelText(/bank/i)).toBeDisabled();
        });

        it('shows hint that account cannot be changed', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByText(/account cannot be changed/i)).toBeInTheDocument();
        });

        it('calls onChange when enabled checkbox toggled', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    editMode={true}
                    onChange={onChange}
                />
            );
            await user.click(screen.getByLabelText(/schedule enabled/i));
            expect(onChange).toHaveBeenCalledWith('enabled', expect.any(Boolean));
        });
    });

    describe('error display', () => {
        it('shows accountId error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{accountId: 'Account is required'}}
                />
            );
            expect(screen.getByText('Account is required')).toBeInTheDocument();
        });

        it('shows bankId error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{bankId: 'Bank is required'}}
                />
            );
            expect(screen.getByText('Bank is required')).toBeInTheDocument();
        });

        it('shows cron error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{cron: 'Invalid cron'}}
                />
            );
            expect(screen.getByText('Invalid cron')).toBeInTheDocument();
        });

        it('shows username error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{username: 'Username required'}}
                />
            );
            expect(screen.getByText('Username required')).toBeInTheDocument();
        });

        it('shows password error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{password: 'Password required'}}
                />
            );
            expect(screen.getByText('Password required')).toBeInTheDocument();
        });

        it('shows lookbackDays error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{lookbackDays: 'Must be 1–365'}}
                />
            );
            expect(screen.getByText('Must be 1–365')).toBeInTheDocument();
        });
    });

    describe('submitting state', () => {
        it('shows "Creating…" when isSubmitting is true in create mode', () => {
            render(<SyncScheduleForm {...defaultProps} isSubmitting={true} />);
            expect(screen.getByRole('button', {name: /creating/i})).toBeInTheDocument();
        });

        it('shows "Saving…" when isSubmitting is true in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} isSubmitting={true} editMode={true} />);
            expect(screen.getByRole('button', {name: /saving/i})).toBeInTheDocument();
        });

        it('disables submit button when isSubmitting', () => {
            render(<SyncScheduleForm {...defaultProps} isSubmitting={true} />);
            expect(screen.getByRole('button', {name: /creating/i})).toBeDisabled();
        });
    });

    describe('when scrapers data is undefined', () => {
        it('renders bank select with no options (besides default)', () => {
            mockScrapers.mockReturnValue({
                data: undefined
            } as ReturnType<typeof useScraperControllerListScrapers>);
            render(<SyncScheduleForm {...defaultProps} />);
            // Only the "Select bank…" placeholder option should exist
            const bankSelect = screen.getByLabelText(/bank/i);
            expect(within(bankSelect).getAllByRole('option')).toHaveLength(1);
        });
    });
});
