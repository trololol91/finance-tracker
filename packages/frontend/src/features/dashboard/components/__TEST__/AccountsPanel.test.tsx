import {
    describe, it, expect
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {AccountsPanel} from '@features/dashboard/components/AccountsPanel.js';
import type {AccountBalanceSummaryItemDto} from '@/api/model/accountBalanceSummaryItemDto.js';

const makeAccount = (
    overrides: Partial<AccountBalanceSummaryItemDto> = {}
): AccountBalanceSummaryItemDto => ({
    id: 'acct-1',
    name: 'Checking',
    currency: 'CAD',
    balance: 1000,
    ...overrides
});

const renderPanel = (props: {accounts: AccountBalanceSummaryItemDto[], isLoading: boolean}) =>
    render(
        <MemoryRouter>
            <AccountsPanel {...props} />
        </MemoryRouter>
    );

describe('AccountsPanel', () => {
    it('renders the section heading', () => {
        renderPanel({accounts: [], isLoading: false});
        expect(screen.getByRole('heading', {name: /accounts/i})).toBeInTheDocument();
    });

    it('shows a link to manage accounts', () => {
        renderPanel({accounts: [], isLoading: false});
        expect(screen.getByRole('link', {name: /manage accounts/i})).toBeInTheDocument();
    });

    it('shows loading state when isLoading is true', () => {
        renderPanel({accounts: [], isLoading: true});
        expect(screen.getByLabelText(/loading accounts/i)).toBeInTheDocument();
    });

    it('shows empty message when there are no accounts', () => {
        renderPanel({accounts: [], isLoading: false});
        expect(screen.getByText(/no accounts found/i)).toBeInTheDocument();
    });

    it('renders account names', () => {
        const accounts = [
            makeAccount({id: 'a1', name: 'Savings'}),
            makeAccount({id: 'a2', name: 'Credit Card'})
        ];
        renderPanel({accounts, isLoading: false});
        expect(screen.getByText('Savings')).toBeInTheDocument();
        expect(screen.getByText('Credit Card')).toBeInTheDocument();
    });

    it('renders formatted balance for each account', () => {
        const accounts = [makeAccount({balance: 1234.56})];
        renderPanel({accounts, isLoading: false});
        expect(screen.getByText(/1,234\.56/)).toBeInTheDocument();
    });

    it('renders currency code for each account', () => {
        const accounts = [makeAccount({currency: 'USD'})];
        renderPanel({accounts, isLoading: false});
        expect(screen.getByText('USD')).toBeInTheDocument();
    });

    it('applies negative balance class for accounts with a negative balance', () => {
        const accounts = [makeAccount({id: 'neg-1', balance: -250})];
        const {container} = renderPanel({accounts, isLoading: false});
        const balanceEl = container.querySelector('[class*="balance--negative"]');
        expect(balanceEl).toBeInTheDocument();
    });

    it('applies positive balance class for accounts with a non-negative balance', () => {
        const accounts = [makeAccount({id: 'pos-1', balance: 100})];
        const {container} = renderPanel({accounts, isLoading: false});
        const balanceEl = container.querySelector('[class*="balance--positive"]');
        expect(balanceEl).toBeInTheDocument();
    });
});
