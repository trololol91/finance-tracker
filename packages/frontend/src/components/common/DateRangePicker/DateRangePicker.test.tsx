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
});
