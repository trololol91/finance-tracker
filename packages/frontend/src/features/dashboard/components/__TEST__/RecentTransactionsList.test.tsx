import {
    describe, it, expect
} from 'vitest';
import {TransactionSummaryItemDtoTransferDirection} from '@/api/model/transactionSummaryItemDtoTransferDirection.js';
import {
    render, screen
} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {RecentTransactionsList} from '@features/dashboard/components/RecentTransactionsList.js';
import type {TransactionSummaryItemDto} from '@/api/model/transactionSummaryItemDto.js';
import {TransactionSummaryItemDtoTransactionType} from '@/api/model/transactionSummaryItemDtoTransactionType.js';

const makeTx = (overrides: Partial<TransactionSummaryItemDto> = {}): TransactionSummaryItemDto => ({
    id: 'tx-1',
    date: '2026-03-01T00:00:00.000Z',
    description: 'Grocery Store',
    amount: 50,
    transactionType: TransactionSummaryItemDtoTransactionType.expense,
    categoryName: 'Food',
    accountName: 'Checking',
    ...overrides
});

const renderList = (props: {
    transactions: TransactionSummaryItemDto[];
    isLoading: boolean;
    isError: boolean;
}) =>
    render(
        <MemoryRouter>
            <RecentTransactionsList {...props} />
        </MemoryRouter>
    );

describe('RecentTransactionsList', () => {
    it('renders the section heading', () => {
        renderList({transactions: [], isLoading: false, isError: false});
        expect(screen.getByRole('heading', {name: /recent transactions/i})).toBeInTheDocument();
    });

    it('renders a view all link', () => {
        renderList({transactions: [], isLoading: false, isError: false});
        expect(screen.getByRole('link', {name: /view all/i})).toBeInTheDocument();
    });

    it('shows loading state when isLoading is true', () => {
        renderList({transactions: [], isLoading: true, isError: false});
        expect(screen.getByLabelText(/loading recent transactions/i)).toBeInTheDocument();
    });

    it('shows error message when isError is true', () => {
        renderList({transactions: [], isLoading: false, isError: true});
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('shows empty message when transactions list is empty', () => {
        renderList({transactions: [], isLoading: false, isError: false});
        expect(screen.getByText(/no recent transactions/i)).toBeInTheDocument();
    });

    it('renders transaction descriptions', () => {
        const transactions = [
            makeTx({id: 'tx-1', description: 'Grocery Store'}),
            makeTx({id: 'tx-2', description: 'Electric Bill'})
        ];
        renderList({transactions, isLoading: false, isError: false});
        expect(screen.getByText('Grocery Store')).toBeInTheDocument();
        expect(screen.getByText('Electric Bill')).toBeInTheDocument();
    });

    it('renders formatted amount with expense prefix', () => {
        const transactions = [makeTx({
            amount: 99.99,
            transactionType: TransactionSummaryItemDtoTransactionType.expense
        })];
        renderList({transactions, isLoading: false, isError: false});
        expect(screen.getByText(/99\.99/)).toBeInTheDocument();
    });

    it('renders income transactions with + prefix', () => {
        const transactions = [makeTx({
            amount: 200,
            transactionType: TransactionSummaryItemDtoTransactionType.income
        })];
        renderList({transactions, isLoading: false, isError: false});
        const el = screen.getByLabelText(/income/i);
        expect(el.textContent).toMatch(/^\+/);
    });

    it('renders category name when present', () => {
        const transactions = [makeTx({categoryName: 'Utilities'})];
        renderList({transactions, isLoading: false, isError: false});
        expect(screen.getByText('Utilities')).toBeInTheDocument();
    });

    it('renders transfer transactions without +/- prefix when direction is absent', () => {
        const transactions = [makeTx({
            amount: 500,
            transactionType: TransactionSummaryItemDtoTransactionType.transfer
        })];
        renderList({transactions, isLoading: false, isError: false});
        const el = screen.getByLabelText(/transfer/i);
        expect(el.textContent).not.toMatch(/^[+-]/);
        expect(el.textContent).toMatch(/500/);
    });

    it('renders transfer-in transactions with + prefix', () => {
        const transactions = [makeTx({
            amount: 500,
            transactionType: TransactionSummaryItemDtoTransactionType.transfer,
            transferDirection: TransactionSummaryItemDtoTransferDirection.in
        })];
        renderList({transactions, isLoading: false, isError: false});
        const el = screen.getByLabelText(/transfer/i);
        expect(el.textContent).toMatch(/^\+/);
        expect(el.textContent).toMatch(/500/);
    });

    it('renders transfer-out transactions with - prefix', () => {
        const transactions = [makeTx({
            amount: 500,
            transactionType: TransactionSummaryItemDtoTransactionType.transfer,
            transferDirection: TransactionSummaryItemDtoTransferDirection.out
        })];
        renderList({transactions, isLoading: false, isError: false});
        const el = screen.getByLabelText(/transfer/i);
        expect(el.textContent).toMatch(/^-/);
        expect(el.textContent).toMatch(/500/);
    });

    it('does not render account name separator when accountName is null', () => {
        const transactions = [makeTx({accountName: null})];
        renderList({transactions, isLoading: false, isError: false});
        // 'Checking' from the default makeTx should not appear
        expect(screen.queryByText('Checking')).not.toBeInTheDocument();
    });

    it('does not render category separator when categoryName is null', () => {
        const transactions = [makeTx({categoryName: null})];
        renderList({transactions, isLoading: false, isError: false});
        expect(screen.queryByText('Food')).not.toBeInTheDocument();
    });
});
