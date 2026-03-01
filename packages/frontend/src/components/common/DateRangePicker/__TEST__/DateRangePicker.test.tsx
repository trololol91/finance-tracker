import {
    describe, it, expect, vi
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DateRangePicker} from '@components/common/DateRangePicker/DateRangePicker.js';

const defaultProps = {
    startDate: '2026-02-01T00:00:00.000Z',
    endDate: '2026-02-28T23:59:59.999Z',
    onChange: vi.fn()
};

describe('DateRangePicker', () => {
    it('renders preset buttons', () => {
        render(<DateRangePicker {...defaultProps} />);
        expect(screen.getByRole('button', {name: /today/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /this week/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /this month/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /this year/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /custom/i})).toBeInTheDocument();
    });

    it('has accessible group label', () => {
        render(<DateRangePicker {...defaultProps} />);
        expect(screen.getByRole('group', {name: /date range/i})).toBeInTheDocument();
    });

    it('calls onChange when a preset is clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<DateRangePicker {...defaultProps} onChange={onChange} />);
        await user.click(screen.getByRole('button', {name: /today/i}));
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            startDate: expect.any(String),
            endDate: expect.any(String)
        }));
    });

    it('shows custom date inputs when Custom is selected', async () => {
        const user = userEvent.setup();
        render(<DateRangePicker {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: /custom/i}));
        expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
    });

    it('calls onChange when custom start date changes', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<DateRangePicker {...defaultProps} onChange={onChange} />);
        await user.click(screen.getByRole('button', {name: /custom/i}));
        const fromInput = screen.getByLabelText(/from/i);
        fireEvent.change(fromInput, {target: {value: '2026-01-01'}});
        expect(onChange).toHaveBeenCalled();
    });

    it('calls onChange when custom end date changes', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<DateRangePicker {...defaultProps} onChange={onChange} />);
        await user.click(screen.getByRole('button', {name: /custom/i}));
        const toInput = screen.getByLabelText(/to/i);
        fireEvent.change(toInput, {target: {value: '2026-12-31'}});
        expect(onChange).toHaveBeenCalled();
    });

    describe('UTC boundaries (BUG-01)', () => {
        it('today preset emits UTC midnight start and end-of-day end', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<DateRangePicker {...defaultProps} onChange={onChange} />);
            await user.click(screen.getByRole('button', {name: /today/i}));
            const [range] = onChange.mock.calls[0] as [{startDate: string, endDate: string}][];
            expect(range.startDate).toMatch(/T00:00:00\.000Z$/);
            expect(range.endDate).toMatch(/T23:59:59\.999Z$/);
        });

        it('this month preset emits the first day at midnight', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<DateRangePicker {...defaultProps} onChange={onChange} />);
            await user.click(screen.getByRole('button', {name: /this month/i}));
            const [range] = onChange.mock.calls[0] as [{startDate: string, endDate: string}][];
            expect(range.startDate).toMatch(/-01T00:00:00\.000Z$/);
            expect(range.endDate).toMatch(/T23:59:59\.999Z$/);
        });

        it('this year preset emits Jan 1 midnight and Dec 31 end-of-day', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<DateRangePicker {...defaultProps} onChange={onChange} />);
            await user.click(screen.getByRole('button', {name: /this year/i}));
            const [range] = onChange.mock.calls[0] as [{startDate: string, endDate: string}][];
            expect(range.startDate).toMatch(/-01-01T00:00:00\.000Z$/);
            expect(range.endDate).toMatch(/-12-31T23:59:59\.999Z$/);
        });

        it('custom start input emits UTC midnight for the chosen date', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<DateRangePicker {...defaultProps} onChange={onChange} />);
            await user.click(screen.getByRole('button', {name: /custom/i}));
            fireEvent.change(screen.getByLabelText(/from/i), {target: {value: '2026-03-15'}});
            const [range] = onChange.mock.calls.at(-1) as [{startDate: string, endDate: string}][];
            expect(range.startDate).toBe('2026-03-15T00:00:00.000Z');
        });

        it('custom end input emits UTC end-of-day for the chosen date', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<DateRangePicker {...defaultProps} onChange={onChange} />);
            await user.click(screen.getByRole('button', {name: /custom/i}));
            fireEvent.change(screen.getByLabelText(/to/i), {target: {value: '2026-03-31'}});
            const [range] = onChange.mock.calls.at(-1) as [{startDate: string, endDate: string}][];
            expect(range.endDate).toBe('2026-03-31T23:59:59.999Z');
        });

        it('this week preset emits UTC Monday midnight start and UTC Sunday end-of-day', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<DateRangePicker {...defaultProps} onChange={onChange} />);
            await user.click(screen.getByRole('button', {name: /this week/i}));
            const [range] = onChange.mock.calls[0] as [{startDate: string, endDate: string}][];
            // startDate is monday at 00:00:00.000Z
            expect(range.startDate).toMatch(/T00:00:00\.000Z$/);
            // endDate is sunday at 23:59:59.999Z
            expect(range.endDate).toMatch(/T23:59:59\.999Z$/);
            // startDate day-of-week is Monday (1)
            expect(new Date(range.startDate).getUTCDay()).toBe(1);
            // endDate day-of-week is Sunday (0)
            expect(new Date(range.endDate).getUTCDay()).toBe(0);
        });
    });

    describe('detectPreset active state', () => {
        it('highlights this-month button when current startDate matches this month start', () => {
            const now = new Date();
            const y = now.getUTCFullYear(), m = now.getUTCMonth();
            const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString();
            const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString();
            render(<DateRangePicker startDate={start} endDate={end} onChange={vi.fn()} />);
            expect(
                screen.getByRole('button', {name: /this month/i})
            ).toHaveAttribute('aria-pressed', 'true');
        });

        it('highlights custom button when dates do not match any preset', () => {
            render(
                <DateRangePicker
                    startDate="2020-06-15T00:00:00.000Z"
                    endDate="2020-06-20T23:59:59.999Z"
                    onChange={vi.fn()}
                />
            );
            expect(
                screen.getByRole('button', {name: /custom/i})
            ).toHaveAttribute('aria-pressed', 'true');
        });
    });
});
