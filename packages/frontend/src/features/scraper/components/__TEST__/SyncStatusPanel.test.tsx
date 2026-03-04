import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SyncStatusPanel} from '@features/scraper/components/SyncStatusPanel.js';
import type {UseSyncStreamResult} from '@features/scraper/types/scraper.types.js';

vi.mock('@features/scraper/hooks/useSyncStream.js', () => ({
    useSyncStream: vi.fn()
}));

import {useSyncStream} from '@features/scraper/hooks/useSyncStream.js';
const mockUseSyncStream = vi.mocked(useSyncStream);

const makeStream = (overrides: Partial<UseSyncStreamResult> = {}): UseSyncStreamResult => ({
    event: {status: 'idle'},
    isConnected: false,
    error: null,
    ...overrides
});

const defaultProps = {
    sessionId: 'session-abc',
    scheduleId: 'sched-1',
    onMfaRequired: vi.fn(),
    onComplete: vi.fn(),
    onClose: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
    mockUseSyncStream.mockReturnValue(makeStream());
});

describe('SyncStatusPanel', () => {
    describe('when sessionId is null', () => {
        it('renders nothing', () => {
            const {container} = render(
                <SyncStatusPanel {...defaultProps} sessionId={null} />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('when sessionId is provided', () => {
        it('renders the panel with aria-label', () => {
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByRole('status', {name: /sync status/i})).toBeInTheDocument();
        });

        it('shows "Sync Status" heading', () => {
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByText('Sync Status')).toBeInTheDocument();
        });

        it('shows a close button', () => {
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByRole('button', {name: /close status panel/i})).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            render(<SyncStatusPanel {...defaultProps} onClose={onClose} />);
            await user.click(screen.getByRole('button', {name: /close status panel/i}));
            expect(onClose).toHaveBeenCalledOnce();
        });
    });

    describe('status labels', () => {
        it.each([
            ['idle', /connecting/i],
            ['running', /running/i],
            ['mfa_required', /waiting for mfa/i],
            ['completed', /sync completed/i],
            ['failed', /sync failed/i]
        ] as const)('shows correct label for %s status', (status, pattern) => {
            mockUseSyncStream.mockReturnValue(
                makeStream({event: {status}})
            );
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByText(pattern)).toBeInTheDocument();
        });

        it('shows event message for running status', () => {
            mockUseSyncStream.mockReturnValue(
                makeStream({event: {status: 'running', message: 'Fetching transactions…'}})
            );
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByText('Fetching transactions…')).toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error message when stream has error', () => {
            mockUseSyncStream.mockReturnValue(
                makeStream({error: 'Connection failed'})
            );
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Connection failed')).toBeInTheDocument();
        });
    });

    describe('completed state', () => {
        it('shows imported and skipped counts', () => {
            mockUseSyncStream.mockReturnValue(
                makeStream({event: {status: 'completed', importedCount: 30, skippedCount: 5}})
            );
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByText('Imported')).toBeInTheDocument();
            expect(screen.getByText('30')).toBeInTheDocument();
            expect(screen.getByText('Skipped')).toBeInTheDocument();
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('shows zeros by default for counts', () => {
            mockUseSyncStream.mockReturnValue(
                makeStream({event: {status: 'completed'}})
            );
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getAllByText('0')).toHaveLength(2);
        });
    });

    describe('failed state', () => {
        it('shows error message from event', () => {
            mockUseSyncStream.mockReturnValue(
                makeStream({event: {status: 'failed', errorMessage: 'Auth error'}})
            );
            render(<SyncStatusPanel {...defaultProps} />);
            expect(screen.getByText('Auth error')).toBeInTheDocument();
        });
    });

    describe('callbacks', () => {
        it('calls onMfaRequired when event status becomes mfa_required', () => {
            const onMfaRequired = vi.fn();
            mockUseSyncStream.mockReturnValue(
                makeStream({event: {status: 'mfa_required', mfaChallenge: 'Enter code'}})
            );
            render(<SyncStatusPanel {...defaultProps} onMfaRequired={onMfaRequired} />);
            expect(onMfaRequired).toHaveBeenCalledWith('Enter code');
        });

        it('calls onComplete when event status becomes completed', () => {
            const onComplete = vi.fn();
            mockUseSyncStream.mockReturnValue(
                makeStream({event: {status: 'completed'}})
            );
            render(<SyncStatusPanel {...defaultProps} onComplete={onComplete} />);
            expect(onComplete).toHaveBeenCalledOnce();
        });
    });
});
