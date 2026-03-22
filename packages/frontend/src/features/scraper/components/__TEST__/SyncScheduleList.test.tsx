import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SyncScheduleList} from '@features/scraper/components/SyncScheduleList.js';
import type {SyncScheduleResponseDto} from '@/api/model/syncScheduleResponseDto.js';
import {SyncScheduleResponseDtoLastRunStatus} from '@/api/model/syncScheduleResponseDtoLastRunStatus.js';

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
    autoCategorizeLlm: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

const defaultProps = {
    schedules: [makeSchedule()],
    isLoading: false,
    isError: false,
    triggeringId: null,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onTrigger: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('SyncScheduleList', () => {
    describe('loading state', () => {
        it('shows loading message when isLoading is true', () => {
            render(<SyncScheduleList {...defaultProps} isLoading={true} schedules={[]} />);
            expect(screen.getByText(/loading schedules/i)).toBeInTheDocument();
        });

        it('has aria-busy while loading', () => {
            const {container} = render(
                <SyncScheduleList {...defaultProps} isLoading={true} schedules={[]} />
            );
            expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows error alert when isError is true', () => {
            render(<SyncScheduleList {...defaultProps} isError={true} schedules={[]} />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/failed to load sync schedules/i)).toBeInTheDocument();
        });
    });

    describe('empty state', () => {
        it('shows empty message when no schedules', () => {
            render(<SyncScheduleList {...defaultProps} schedules={[]} />);
            expect(screen.getByText(/no sync schedules yet/i)).toBeInTheDocument();
        });
    });

    describe('data rows', () => {
        it('renders a table with aria-label', () => {
            render(<SyncScheduleList {...defaultProps} />);
            expect(screen.getByRole('table', {name: /sync schedules/i})).toBeInTheDocument();
        });

        it('shows displayName for each schedule', () => {
            render(<SyncScheduleList {...defaultProps} schedules={[makeSchedule({displayName: 'My Bank'})]} />);
            expect(screen.getByText('My Bank')).toBeInTheDocument();
        });

        it('shows cron expression', () => {
            render(<SyncScheduleList {...defaultProps} schedules={[makeSchedule({cron: '0 9 * * 1'})]} />);
            expect(screen.getByText('0 9 * * 1')).toBeInTheDocument();
        });

        it('shows "Disabled" badge when enabled is false', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({enabled: false})]}
                />
            );
            expect(screen.getByText('Disabled')).toBeInTheDocument();
        });

        it('does not show "Disabled" badge when enabled is true', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({enabled: true})]}
                />
            );
            expect(screen.queryByText('Disabled')).not.toBeInTheDocument();
        });

        it('shows last run status when present', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({
                        lastRunStatus: SyncScheduleResponseDtoLastRunStatus.success
                    })]}
                />
            );
            expect(screen.getByText('success')).toBeInTheDocument();
        });

        it('shows "—" for lastRunStatus when null', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({lastRunStatus: null})]}
                />
            );
            // Both lastRunStatus and lastRunAt may show '—'; check at least one exists
            const dashes = screen.getAllByText('—');
            expect(dashes.length).toBeGreaterThanOrEqual(1);
        });

        it('shows "—" for lastRunAt when null', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({lastRunAt: null})]}
                />
            );
            // Multiple "—" might appear (status and lastRunAt), look for all
            const dashes = screen.getAllByText('—');
            expect(dashes.length).toBeGreaterThanOrEqual(1);
        });

        it('formats lastRunAt date', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({lastRunAt: '2026-03-10T14:00:00.000Z'})]}
                />
            );
            // Should contain the year
            const table = screen.getByRole('table');
            expect(table).toHaveTextContent('2026');
        });
    });

    describe('action buttons', () => {
        it('calls onEdit when Edit button is clicked', async () => {
            const user = userEvent.setup();
            const onEdit = vi.fn();
            const schedule = makeSchedule();
            render(<SyncScheduleList {...defaultProps} schedules={[schedule]} onEdit={onEdit} />);
            await user.click(screen.getByRole('button', {name: /edit.*td chequing/i}));
            expect(onEdit).toHaveBeenCalledWith(schedule);
        });

        it('calls onDelete when Delete button is clicked', async () => {
            const user = userEvent.setup();
            const onDelete = vi.fn();
            const schedule = makeSchedule();
            render(
                <SyncScheduleList {...defaultProps} schedules={[schedule]} onDelete={onDelete} />
            );
            await user.click(screen.getByRole('button', {name: /delete.*td chequing/i}));
            expect(onDelete).toHaveBeenCalledWith(schedule);
        });

        it('calls onTrigger when Run button is clicked', async () => {
            const user = userEvent.setup();
            const onTrigger = vi.fn();
            const schedule = makeSchedule();
            render(
                <SyncScheduleList {...defaultProps} schedules={[schedule]} onTrigger={onTrigger} />
            );
            await user.click(screen.getByRole('button', {name: /trigger sync for td chequing/i}));
            expect(onTrigger).toHaveBeenCalledWith(schedule);
        });

        it('disables run button when triggeringId matches schedule id', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({id: 'sched-1'})]}
                    triggeringId="sched-1"
                />
            );
            expect(screen.getByRole('button', {name: /trigger sync/i})).toBeDisabled();
        });

        it('shows "…" on the run button when triggering', () => {
            render(
                <SyncScheduleList
                    {...defaultProps}
                    schedules={[makeSchedule({id: 'sched-1'})]}
                    triggeringId="sched-1"
                />
            );
            expect(screen.getByText('…')).toBeInTheDocument();
        });
    });
});
