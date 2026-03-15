import {
    describe, it, expect
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import {SummaryCard} from '@features/dashboard/components/SummaryCard.js';

describe('SummaryCard', () => {
    it('renders the title', () => {
        render(<SummaryCard title="Net Balance" value="$1,000.00" />);
        expect(screen.getByText('Net Balance')).toBeInTheDocument();
    });

    it('renders a string value', () => {
        render(<SummaryCard title="Savings Rate" value="42.5%" />);
        expect(screen.getByText('42.5%')).toBeInTheDocument();
    });

    it('renders a numeric value', () => {
        render(<SummaryCard title="Count" value={7} />);
        expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
        render(<SummaryCard title="Income" value="$500" subtitle="This month" />);
        expect(screen.getByText('This month')).toBeInTheDocument();
    });

    it('renders an up trend indicator', () => {
        render(<SummaryCard title="Income" value="$500" trend="up" />);
        expect(screen.getByLabelText('Trend: up')).toBeInTheDocument();
    });

    it('renders a down trend indicator', () => {
        render(<SummaryCard title="Expenses" value="$300" trend="down" />);
        expect(screen.getByLabelText('Trend: down')).toBeInTheDocument();
    });

    it('renders a neutral trend indicator', () => {
        render(<SummaryCard title="Balance" value="$0" trend="neutral" />);
        expect(screen.getByLabelText('Trend: neutral')).toBeInTheDocument();
    });

    it('does not render trend row when neither trend nor subtitle is provided', () => {
        const {container} = render(<SummaryCard title="Title" value="Value" />);
        expect(container.querySelector('[class*="trendRow"]')).not.toBeInTheDocument();
    });

    it('renders trend row when only subtitle is provided', () => {
        const {container} = render(<SummaryCard title="Title" value="Value" subtitle="Sub" />);
        expect(container.querySelector('[class*="trendRow"]')).toBeInTheDocument();
    });
});
