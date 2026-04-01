import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionActions} from '@features/transactions/components/TransactionActions.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';

const mockTx: TransactionResponseDto = {
    id: 'tx-1',
    userId: 'user-1',
    amount: 42.5,
    description: 'Test Transaction',
    notes: null,
    categoryId: null,
    accountId: null,
    transactionType: 'expense',
    date: '2026-02-15T12:00:00.000Z',
    originalDate: '2026-02-15T12:00:00.000Z',
    isActive: true,
    isPending: false,
    createdAt: '2026-02-15T12:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z'
};

const defaultProps = {
    transaction: mockTx,
    onEdit: vi.fn(),
    onToggleActive: vi.fn(),
    onDelete: vi.fn()
};

describe('TransactionActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the trigger button', () => {
        render(<TransactionActions {...defaultProps} />);
        expect(screen.getByRole('button', {name: /actions for test transaction/i})).toBeInTheDocument();
    });

    it('opens menu on trigger click', async () => {
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('calls onEdit when Edit is clicked', async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} onEdit={onEdit} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        await user.click(screen.getByRole('menuitem', {name: /edit/i}));
        expect(onEdit).toHaveBeenCalledWith(mockTx);
    });

    it('calls onToggleActive when Mark Inactive is clicked', async () => {
        const onToggleActive = vi.fn();
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} onToggleActive={onToggleActive} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        await user.click(screen.getByRole('menuitem', {name: /mark inactive/i}));
        expect(onToggleActive).toHaveBeenCalledWith('tx-1');
    });

    it('shows Mark Active for inactive transactions', async () => {
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} transaction={{...mockTx, isActive: false}} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        expect(screen.getByRole('menuitem', {name: /mark active/i})).toBeInTheDocument();
    });

    it('shows confirmation before deleting', async () => {
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        await user.click(screen.getByRole('menuitem', {name: /delete/i}));
        expect(screen.getByText(/delete this transaction/i)).toBeInTheDocument();
    });

    it('calls onDelete after confirmation', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} onDelete={onDelete} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        await user.click(screen.getByRole('menuitem', {name: /delete/i}));
        // Confirm dialog shown; click the delete button in confirm dialog
        const deleteButtons = screen.getAllByRole('button', {name: /delete/i});
        const confirmBtn = deleteButtons[deleteButtons.length - 1];
        await user.click(confirmBtn);
        expect(onDelete).toHaveBeenCalledWith('tx-1');
    });

    it('closes menu on Escape', async () => {
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes menu when a mousedown occurs outside the component', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <TransactionActions {...defaultProps} />
                <button type="button">Outside</button>
            </div>
        );
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        // clicking an element outside the component triggers the mousedown handler
        await user.click(screen.getByRole('button', {name: /outside/i}));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('opens menu upward when trigger is near the bottom of the viewport', async () => {
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} />);
        const trigger = screen.getByRole('button', {name: /actions for/i});
        // Simulate trigger near the bottom: little space below, lots above
        vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
            top: 700, bottom: 720, left: 0, right: 100,
            width: 100, height: 20, x: 0, y: 700, toJSON: () => ({})
        } as DOMRect);
        Object.defineProperty(window, 'innerHeight', {value: 750, configurable: true});
        Object.defineProperty(window, 'innerWidth', {value: 1024, configurable: true});
        await user.click(trigger);
        const menu = screen.getByRole('menu');
        // Menu should be positioned with `bottom` (opens upward), not `top`
        expect(menu.style.bottom).not.toBe('');
        expect(menu.style.top).toBe('');
    });

    it('cancels the delete confirmation when Cancel is clicked', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(<TransactionActions {...defaultProps} onDelete={onDelete} />);
        await user.click(screen.getByRole('button', {name: /actions for/i}));
        await user.click(screen.getByRole('menuitem', {name: /delete/i}));
        expect(screen.getByText(/delete this transaction/i)).toBeInTheDocument();
        // Click Cancel — confirm panel must disappear, onDelete must NOT be called
        await user.click(screen.getByRole('button', {name: /cancel/i}));
        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.queryByText(/delete this transaction/i)).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /edit/i})).toBeInTheDocument();
    });
});
