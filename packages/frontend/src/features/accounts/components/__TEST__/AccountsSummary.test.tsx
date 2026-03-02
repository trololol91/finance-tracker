import {
    describe, it, expect
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import {AccountsSummary} from '@features/accounts/components/AccountsSummary.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import {CreateAccountDtoType} from '@/api/model/createAccountDtoType.js';

const makeAccount = (overrides: Partial<AccountResponseDto> = {}): AccountResponseDto => ({
    id: 'acct-1',
    userId: 'user-1',
    name: 'Checking',
    type: CreateAccountDtoType.checking,
    institution: null,
    currency: 'CAD',
    openingBalance: 0,
    currentBalance: 1000,
    transactionCount: 5,
    color: null,
    notes: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

describe('AccountsSummary', () => {
    it('renders the summary bar with correct aria-label', () => {
        render(<AccountsSummary accounts={[]} />);
        expect(screen.getByRole('generic', {name: /account totals/i})).toBeInTheDocument();
    });

    it('shows 0 active accounts when accounts list is empty', () => {
        render(<AccountsSummary accounts={[]} />);
        const stats = screen.getAllByText('0');
        // At least one "0" rendered (accounts count and/or transactions)
        expect(stats.length).toBeGreaterThan(0);
    });

    it('shows correct active account count', () => {
        const accounts = [
            makeAccount({id: 'a1', isActive: true}),
            makeAccount({id: 'a2', isActive: true}),
            makeAccount({id: 'a3', isActive: false})
        ];
        render(<AccountsSummary accounts={accounts} />);
        // "Accounts" label followed by value "2"
        expect(screen.getByText('Accounts')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('excludes inactive accounts from totals', () => {
        const accounts = [
            makeAccount({id: 'a1', isActive: true, currentBalance: 500, transactionCount: 3}),
            makeAccount({id: 'a2', isActive: false, currentBalance: 999, transactionCount: 99})
        ];
        render(<AccountsSummary accounts={accounts} />);
        // Total transactions should be 3, not 102
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows correct total transactions', () => {
        const accounts = [
            makeAccount({id: 'a1', isActive: true, transactionCount: 10}),
            makeAccount({id: 'a2', isActive: true, transactionCount: 5})
        ];
        render(<AccountsSummary accounts={accounts} />);
        expect(screen.getByText('Total Transactions')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('shows net balance formatted as CAD currency', () => {
        const accounts = [makeAccount({currentBalance: 1234.56})];
        render(<AccountsSummary accounts={accounts} />);
        expect(screen.getByText('Net Balance')).toBeInTheDocument();
        // Formatted CAD — includes $1,234.56 with any currency symbol
        const balanceEl = screen.getByText(/1,234\.56/);
        expect(balanceEl).toBeInTheDocument();
    });

    it('applies negative CSS class when balance is negative', () => {
        const {container} = render(
            <AccountsSummary accounts={[makeAccount({currentBalance: -500})]} />
        );
        const negativeEl = container.querySelector('[class*="negative"]');
        expect(negativeEl).toBeInTheDocument();
    });

    it('applies positive CSS class when balance is positive', () => {
        const {container} = render(
            <AccountsSummary accounts={[makeAccount({currentBalance: 500})]} />
        );
        const positiveEl = container.querySelector('[class*="positive"]');
        expect(positiveEl).toBeInTheDocument();
    });
});
