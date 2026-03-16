import {
    describe, it, expect, vi, beforeAll, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SyncScheduleModal} from '@features/scraper/components/SyncScheduleModal.js';
import type {
    SyncScheduleFormValues, SyncScheduleFormErrors
} from '@features/scraper/types/scraper.types.js';

// Mock the form body so we can test the modal wrapper independently
vi.mock('@features/scraper/components/SyncScheduleForm.js', () => ({
    SyncScheduleForm: ({onSubmit}: {onSubmit: (e: React.FormEvent) => void}) => (
        <form onSubmit={onSubmit} aria-label="form">
            <input aria-label="test-input" />
            <button type="submit">Submit</button>
        </form>
    )
}));

const mockShowModal = vi.fn(function(this: HTMLDialogElement) {
    this.setAttribute('open', '');
});
const mockClose = vi.fn(function(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
});

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = mockShowModal;
    HTMLDialogElement.prototype.close = mockClose;
});

const emptyValues: SyncScheduleFormValues = {
    accountId: '',
    bankId: '',
    inputs: {},
    cron: '0 8 * * *',
    lookbackDays: '3',
    enabled: true
};

const defaultProps = {
    mode: 'create' as const,
    values: emptyValues,
    errors: {} as SyncScheduleFormErrors,
    isSubmitting: false,
    onClose: vi.fn(),
    onChange: vi.fn(),
    onInputChange: vi.fn(),
    onSubmit: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
    mockShowModal.mockClear();
    mockClose.mockClear();
});

describe('SyncScheduleModal', () => {
    describe('closed state', () => {
        it('does not show dialog open when mode is null', () => {
            const {container} = render(
                <SyncScheduleModal {...defaultProps} mode={null} />
            );
            const dialog = container.querySelector('dialog');
            expect(dialog?.hasAttribute('open')).toBe(false);
        });
    });

    describe('create mode', () => {
        it('shows "New Sync Schedule" heading', () => {
            render(<SyncScheduleModal {...defaultProps} mode="create" />);
            expect(
                screen.getByRole('heading', {name: 'New Sync Schedule'})
            ).toBeInTheDocument();
        });

        it('has aria-modal="true"', () => {
            const {container} = render(<SyncScheduleModal {...defaultProps} mode="create" />);
            expect(container.querySelector('[aria-modal="true"]')).toBeInTheDocument();
        });

        it('shows a close button', () => {
            render(<SyncScheduleModal {...defaultProps} mode="create" />);
            expect(screen.getByRole('button', {name: /close dialog/i})).toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        it('shows "Edit Sync Schedule" heading', () => {
            render(<SyncScheduleModal {...defaultProps} mode="edit" />);
            expect(
                screen.getByRole('heading', {name: 'Edit Sync Schedule'})
            ).toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            render(<SyncScheduleModal {...defaultProps} onClose={onClose} />);
            await user.click(screen.getByRole('button', {name: /close dialog/i}));
            expect(onClose).toHaveBeenCalledOnce();
        });

        it('calls onClose when dialog close event fires', () => {
            const onClose = vi.fn();
            const {container} = render(
                <SyncScheduleModal {...defaultProps} onClose={onClose} />
            );
            const dialog = container.querySelector('dialog')!;
            dialog.dispatchEvent(new Event('close'));
            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when Escape key is pressed', () => {
            const onClose = vi.fn();
            const {container} = render(
                <SyncScheduleModal {...defaultProps} onClose={onClose} />
            );
            const dialog = container.querySelector('dialog')!;
            fireEvent.keyDown(dialog, {key: 'Escape'});
            expect(onClose).toHaveBeenCalled();
        });

        it('ignores non-Tab/Escape key presses', () => {
            const onClose = vi.fn();
            const {container} = render(
                <SyncScheduleModal {...defaultProps} onClose={onClose} />
            );
            const dialog = container.querySelector('dialog')!;
            fireEvent.keyDown(dialog, {key: 'Enter'});
            expect(onClose).not.toHaveBeenCalled();
        });

        it('does not throw on Tab key when focusable elements exist', () => {
            const {container} = render(<SyncScheduleModal {...defaultProps} />);
            const dialog = container.querySelector('dialog')!;
            expect(() => {
                fireEvent.keyDown(dialog, {key: 'Tab', shiftKey: false});
            }).not.toThrow();
        });

        it('does not throw on Shift+Tab key', () => {
            const {container} = render(<SyncScheduleModal {...defaultProps} />);
            const dialog = container.querySelector('dialog')!;
            expect(() => {
                fireEvent.keyDown(dialog, {key: 'Tab', shiftKey: true});
            }).not.toThrow();
        });
    });
});
